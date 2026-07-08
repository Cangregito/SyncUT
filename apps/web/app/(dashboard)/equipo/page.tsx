import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Tables } from "@plataforma/types";

import { requireProfile } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type TutorTeam = Tables<"tutor_teams"> & {
  tutor?: Pick<Tables<"profiles">, "full_name" | "email"> | null;
  tutor_team_members?: TeamMember[];
};

type TeamMember = Tables<"tutor_team_members"> & {
  student?: {
    student_code: string;
    profile?: Pick<Tables<"profiles">, "full_name" | "email"> | null;
  } | null;
};

type TeacherDirectoryRow = {
  department: string;
  email: string;
  full_name: string;
  id: string;
};

async function createTeam(formData: FormData) {
  "use server";

  const profile = await requireProfile();
  if (profile.role !== "tutor" && profile.role !== "admin") {
    redirect("/equipo?error=forbidden");
  }

  const name = String(formData.get("name") ?? "").trim() || "Equipo tutorial";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_tutor_team", { p_name: name });

  if (error) {
    redirect(`/equipo?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/equipo");
  redirect("/equipo?created=true");
}

async function joinTeam(formData: FormData) {
  "use server";

  const profile = await requireProfile();
  if (profile.role !== "student") {
    redirect("/equipo?error=forbidden");
  }

  const code = String(formData.get("join_code") ?? "").trim();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("join_tutor_team", { p_join_code: code });

  if (error) {
    redirect(`/equipo?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/equipo");
  revalidatePath("/citas");
  revalidatePath("/justificaciones");
  redirect("/equipo?joined=true");
}

async function sendTeacherMessage(formData: FormData) {
  "use server";

  const profile = await requireProfile();
  if (!["tutor", "admin", "coordinator"].includes(profile.role)) {
    redirect("/equipo?error=forbidden");
  }

  const teamId = String(formData.get("team_id") ?? "");
  const teacherId = String(formData.get("teacher_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!teamId || !teacherId || !title || !body) {
    redirect("/equipo?error=missing_message");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("send_tutor_teacher_notification", {
    p_team_id: teamId,
    p_teacher_id: teacherId,
    p_title: title,
    p_body: body,
  });

  if (error) {
    redirect(`/equipo?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/equipo");
  revalidatePath("/notificaciones");
  redirect("/equipo?sent=true");
}

export default async function EquipoTutorialPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; joined?: string; sent?: string; error?: string }>;
}) {
  const profile = await requireProfile();
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const canManageTeam = ["tutor", "admin"].includes(profile.role);
  const canSendTeacherMessages = ["tutor", "admin", "coordinator"].includes(profile.role);

  const { data: teamsData, error: teamsError } = await supabase
    .from("tutor_teams")
    .select(`
      id,
      tutor_id,
      name,
      join_code,
      is_active,
      created_at,
      updated_at,
      tutor:profiles!tutor_teams_tutor_id_fkey(full_name,email),
      tutor_team_members(
        id,
        team_id,
        student_id,
        joined_at,
        status,
        student:students!tutor_team_members_student_id_fkey(
          student_code,
          profile:profiles!students_id_fkey(full_name,email)
        )
      )
    `)
    .order("created_at", { ascending: false });

  const teams = (teamsData ?? []) as unknown as TutorTeam[];
  const activeTeam = teams.find((team) => team.is_active) ?? teams[0] ?? null;

  const { data: teacherDirectoryData } = canSendTeacherMessages
    ? await supabase.rpc("get_teacher_directory")
    : { data: [] };
  const teacherDirectory = (teacherDirectoryData ?? []) as TeacherDirectoryRow[];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Flujo tutorial</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-headline font-bold text-on-surface">
          Equipo Tutorial
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
          {profile.role === "student"
            ? "Únete al equipo de tu tutor con el código que te comparta. Desde ahí se conectan citas, justificaciones y avisos."
            : "Administra el código del equipo tutorial y coordina avisos académicos con docentes."}
        </p>
      </header>

      {params.created || params.joined || params.sent ? (
        <p className="rounded border border-tertiary/40 bg-tertiary-container/20 p-3 text-sm font-semibold text-on-tertiary-container">
          {params.created ? "Equipo creado correctamente." : params.joined ? "Te uniste al equipo tutorial." : "Notificación enviada al docente."}
        </p>
      ) : null}

      {params.error ? (
        <p className="rounded border border-error/40 bg-error-container/20 p-3 text-sm font-semibold text-on-error-container">
          No se pudo completar la acción. Revisa los datos o permisos del flujo.
        </p>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <p className="text-xs uppercase text-on-surface-variant">Rol actual</p>
          <p className="mt-2 text-lg font-bold text-on-surface">{ROLE_LABELS[profile.role]}</p>
        </div>
        <div className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <p className="text-xs uppercase text-on-surface-variant">Equipos visibles</p>
          <p className="mt-2 text-3xl font-bold text-on-surface">{teams.length}</p>
        </div>
        <div className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <p className="text-xs uppercase text-on-surface-variant">Docentes para aviso</p>
          <p className="mt-2 text-3xl font-bold text-primary">{teacherDirectory.length}</p>
        </div>
      </section>

      {profile.role === "student" ? (
        <section className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Unirse por código</h2>
          <form action={joinTeam} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              name="join_code"
              className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm uppercase tracking-widest text-on-surface sm:max-w-64"
              placeholder="ABC123"
              maxLength={6}
              required
            />
            <button className="rounded bg-primary px-4 py-2 text-sm font-bold text-on-primary">
              Entrar al equipo
            </button>
          </form>
        </section>
      ) : null}

      {canManageTeam ? (
        <section className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Crear equipo de tutor</h2>
          <form action={createTeam} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              name="name"
              className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface sm:max-w-md"
              placeholder="Equipo TSU Desarrollo de Software"
            />
            <button className="rounded bg-primary px-4 py-2 text-sm font-bold text-on-primary">
              Generar código
            </button>
          </form>
        </section>
      ) : null}

      <section className="rounded-lg border border-outline-variant bg-surface-container p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Equipos y alumnos</h2>
          {teamsError ? <span className="text-xs font-semibold text-error">{teamsError.message}</span> : null}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {teams.length === 0 && !teamsError ? (
            <p className="rounded border border-outline-variant bg-surface p-4 text-sm text-on-surface-variant lg:col-span-2">
              Aún no hay equipos visibles para tu cuenta.
            </p>
          ) : null}

          {teams.map((team) => (
            <article key={team.id} className="rounded border border-outline-variant bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-on-surface">{team.name}</h3>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Tutor: {team.tutor?.full_name ?? team.tutor?.email ?? team.tutor_id}
                  </p>
                </div>
                <div className="rounded border border-primary bg-primary-container px-3 py-2 text-center">
                  <p className="text-[10px] font-semibold uppercase text-on-primary-container">Código</p>
                  <p className="font-mono text-lg font-black tracking-widest text-on-primary-container">{team.join_code}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {(team.tutor_team_members ?? []).length === 0 ? (
                  <p className="rounded border border-outline-variant bg-surface-container p-3 text-xs text-on-surface-variant">
                    Sin alumnos unidos todavía.
                  </p>
                ) : null}
                {(team.tutor_team_members ?? []).map((member) => (
                  <div key={member.id} className="rounded border border-outline-variant bg-surface-container p-3">
                    <p className="text-sm font-semibold text-on-surface">
                      {member.student?.profile?.full_name ?? member.student?.profile?.email ?? member.student_id}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Matrícula {member.student?.student_code ?? "pendiente"} · {member.status}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {canSendTeacherMessages && activeTeam ? (
        <section className="rounded-lg border border-outline-variant bg-surface-container p-5">
          <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Aviso tutor-docente</h2>
          <form action={sendTeacherMessage} className="mt-4 grid gap-4 md:grid-cols-2">
            <input type="hidden" name="team_id" value={activeTeam.id} />
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase text-on-surface-variant" htmlFor="teacher_id">
                Docente
              </label>
              <select id="teacher_id" name="teacher_id" className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" required>
                <option value="">Selecciona docente</option>
                {teacherDirectory.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.full_name} · {teacher.department}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase text-on-surface-variant" htmlFor="title">
                Asunto
              </label>
              <input id="title" name="title" className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" required />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase text-on-surface-variant" htmlFor="body">
                Mensaje
              </label>
              <textarea
                id="body"
                name="body"
                className="min-h-28 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
                required
              />
            </div>
            <div className="md:col-span-2">
              <button className="rounded bg-primary px-4 py-2 text-sm font-bold text-on-primary">
                Enviar notificación
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
