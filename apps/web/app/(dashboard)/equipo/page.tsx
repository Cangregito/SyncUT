import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Tables } from "@plataforma/types";

import { SubmitButton } from "@/components/forms/submit-button";
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
  if (!["tutor", "admin"].includes(profile.role)) {
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

async function sendTeamAnnouncement(formData: FormData) {
  "use server";
  const profile = await requireProfile();
  if (!['tutor', 'admin'].includes(profile.role)) redirect('/equipo?error=forbidden');
  const teamId = String(formData.get('team_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  if (!teamId || title.length < 3 || body.length < 5) redirect('/equipo?error=Completa el asunto y el aviso.');
  const supabase = await createSupabaseServerClient();
  const { data: team } = await supabase.from('tutor_teams').select('id,tutor_id').eq('id', teamId).maybeSingle();
  if (!team || (profile.role !== 'admin' && team.tutor_id !== profile.id)) redirect('/equipo?error=No tienes acceso a ese equipo.');
  const { data: members, error: membersError } = await supabase.from('tutor_team_members').select('student_id').eq('team_id', teamId).eq('status', 'active');
  if (membersError) redirect(`/equipo?error=${encodeURIComponent(membersError.message)}`);
  const results = await Promise.all((members ?? []).map((member) => supabase.rpc('emit_notification', {
    p_user_id: member.student_id, p_event_type: 'tutor_team.announcement', p_title: title, p_body: body,
    p_metadata: { team_id: teamId }, p_triggered_by: profile.id,
  })));
  const failure = results.find((result) => result.error)?.error;
  if (failure) redirect(`/equipo?error=${encodeURIComponent(failure.message)}`);
  revalidatePath('/equipo'); revalidatePath('/notificaciones');
  redirect('/equipo?announced=true');
}

async function scheduleStudentAppointment(formData: FormData) {
  "use server";
  const profile = await requireProfile();
  if (!['tutor', 'admin'].includes(profile.role)) redirect('/equipo?error=forbidden');
  const studentId = String(formData.get('student_id') ?? '');
  const scheduledDate = String(formData.get('scheduled_date') ?? '');
  const startsAt = String(formData.get('starts_at') ?? '');
  const endsAt = String(formData.get('ends_at') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!studentId || !scheduledDate || !startsAt || !endsAt || endsAt <= startsAt || reason.length < 5) redirect('/equipo?error=Revisa los datos de la cita.');
  const supabase = await createSupabaseServerClient();
  const { data: membership } = await supabase.from('tutor_team_members').select('team:tutor_teams!inner(tutor_id)').eq('student_id', studentId).eq('status', 'active').eq('team.tutor_id', profile.id).maybeSingle();
  if (!membership && profile.role !== 'admin') redirect('/equipo?error=El alumno no pertenece a uno de tus equipos.');
  const { data: appointment, error } = await supabase.from('appointments').insert({
    student_id: studentId, tutor_id: profile.id, scheduled_date: scheduledDate, starts_at: startsAt,
    ends_at: endsAt, modality: 'presencial', location: 'Por confirmar', reason, status: 'confirmada',
  }).select('id').single();
  if (error || !appointment) redirect(`/equipo?error=${encodeURIComponent(error?.message ?? 'No se pudo crear la cita.')}`);
  await supabase.rpc('emit_notification', { p_user_id: studentId, p_event_type: 'appointment.created',
    p_title: 'Tu tutor agendó una cita', p_body: `${scheduledDate}, ${startsAt.slice(0,5)}-${endsAt.slice(0,5)}. ${reason}`,
    p_metadata: { appointment_id: appointment.id }, p_triggered_by: profile.id });
  revalidatePath('/equipo'); revalidatePath('/citas');
  redirect('/equipo?scheduled=true');
}

export default async function EquipoTutorialPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; joined?: string; sent?: string; announced?: string; scheduled?: string; error?: string }>;
}) {
  const profile = await requireProfile();
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const canManageTeam = ["tutor", "admin"].includes(profile.role);
  const canSendTeacherMessages = ["tutor", "admin"].includes(profile.role);

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
  const studentTeam = profile.role === "student" ? activeTeam : null;

  const memberIds = [...new Set(teams.flatMap((team) => (team.tutor_team_members ?? []).filter((member) => member.status === 'active').map((member) => member.student_id)))];
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: incidentSignals }, { data: justificationSignals }, { data: attendanceSignals }] = memberIds.length
    ? await Promise.all([
        supabase.from('incidents').select('reported_by,priority,status,created_at').in('reported_by', memberIds).gte('created_at', since),
        supabase.from('justifications').select('student_id,status,created_at').in('student_id', memberIds).gte('created_at', since),
        supabase.from('appointment_attendance').select('status,appointment:appointments!inner(student_id)').in('appointment.student_id', memberIds).gte('recorded_at', since),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const teamHealth = new Map(teams.map((team) => {
    const ids = new Set((team.tutor_team_members ?? []).filter((member) => member.status === 'active').map((member) => member.student_id));
    const incidents = (incidentSignals ?? []).filter((row) => ids.has(row.reported_by));
    const justifications = (justificationSignals ?? []).filter((row) => ids.has(row.student_id));
    const absences = (attendanceSignals ?? []).filter((row) => ids.has((row.appointment as unknown as { student_id: string }).student_id) && row.status !== 'attended');
    const score = incidents.length * 2 + incidents.filter((row) => row.priority === 'alta' && !['resuelta','cerrada'].includes(row.status)).length * 2 + justifications.length + absences.length * 2;
    const level = score >= 8 ? 'red' : score >= 4 ? 'yellow' : 'green';
    return [team.id, { level, score, incidents: incidents.length, justifications: justifications.length, absences: absences.length }] as const;
  }));

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

      {params.created || params.joined || params.sent || params.announced || params.scheduled ? (
        <p className="rounded border border-tertiary/40 bg-tertiary-container/20 p-3 text-sm font-semibold text-on-tertiary-container">
          {params.created ? "Equipo creado correctamente." : params.joined ? "Te uniste al equipo tutorial." : params.announced ? 'Aviso enviado al grupo y agregado a la cola de correo.' : params.scheduled ? 'Cita agendada y notificada al alumno.' : "Notificación enviada al docente."}
        </p>
      ) : null}

      {params.error ? (
        <p className="rounded border border-error/40 bg-error-container/20 p-3 text-sm font-semibold text-on-error-container">
          No se pudo completar la acción: {params.error === "forbidden" ? "tu rol no tiene permiso para esta operación." : params.error}
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
          <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Mi equipo tutorial</h2>
          {studentTeam ? (
            <div className="mt-4 rounded border border-outline-variant bg-surface p-4">
              <p className="text-base font-semibold text-on-surface">{studentTeam.name}</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Tutor: {studentTeam.tutor?.full_name ?? studentTeam.tutor?.email ?? studentTeam.tutor_id}
              </p>
              <p className="mt-3 text-xs text-on-surface-variant">
                Desde este equipo se conectan tus citas, justificaciones y avisos tutoriales.
              </p>
            </div>
          ) : (
            <p className="mt-4 rounded border border-outline-variant bg-surface p-3 text-sm text-on-surface-variant">
              Todavía no perteneces a un equipo. Ingresa el código que te compartió tu tutor.
            </p>
          )}
          <h3 className="mt-5 text-xs font-semibold uppercase text-on-surface-variant">Unirse por código</h3>
          <form action={joinTeam} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              name="join_code"
              className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm uppercase tracking-widest text-on-surface sm:max-w-64"
              placeholder="ABC123"
              maxLength={6}
              required
            />
            <SubmitButton className="rounded bg-primary px-4 py-2 text-sm font-bold text-on-primary disabled:opacity-60" pendingLabel="Entrando...">
              Entrar al equipo
            </SubmitButton>
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
            <SubmitButton className="rounded bg-primary px-4 py-2 text-sm font-bold text-on-primary disabled:opacity-60" pendingLabel="Generando...">
              Generar código
            </SubmitButton>
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

          {teams.map((team) => {
            const health = teamHealth.get(team.id) ?? { level: 'green', score: 0, incidents: 0, justifications: 0, absences: 0 };
            const healthStyle = health.level === 'red' ? 'border-red-500 bg-red-500/10 text-red-300' : health.level === 'yellow' ? 'border-amber-500 bg-amber-500/10 text-amber-300' : 'border-emerald-500 bg-emerald-500/10 text-emerald-300';
            return (
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
              <div className={`mt-4 rounded border p-3 ${healthStyle}`}>
                <div className="flex items-center justify-between gap-3"><p className="text-sm font-bold">Salud del grupo: {health.level === 'red' ? 'Requiere atención' : health.level === 'yellow' ? 'En observación' : 'Estable'}</p><span className="text-xl">●</span></div>
                <p className="mt-2 text-xs">Últimos 30 días · {health.incidents} incidencias · {health.justifications} justificantes · {health.absences} inasistencias a tutoría</p>
                <p className="mt-1 text-[11px] opacity-80">Indicador orientativo para priorizar seguimiento; revisa el contexto individual antes de intervenir.</p>
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
            );
          })}
        </div>
      </section>

      {canManageTeam && activeTeam ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <form action={sendTeamAnnouncement} className="rounded-lg border border-outline-variant bg-surface-container p-5">
            <input type="hidden" name="team_id" value={activeTeam.id} />
            <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Aviso al grupo</h2>
            <p className="mt-2 text-xs text-on-surface-variant">Se entrega dentro de SyncUT y se agrega a la cola de correo de cada alumno, respetando sus preferencias.</p>
            <input name="title" required minLength={3} maxLength={120} placeholder="Asunto del aviso" className="mt-4 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
            <textarea name="body" required minLength={5} rows={4} placeholder="Mensaje para todo el equipo" className="mt-3 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
            <SubmitButton className="mt-3 rounded bg-primary px-4 py-2 text-sm font-bold text-on-primary" pendingLabel="Enviando...">Enviar al grupo</SubmitButton>
          </form>

          <form action={scheduleStudentAppointment} className="rounded-lg border border-outline-variant bg-surface-container p-5">
            <h2 className="text-sm font-semibold uppercase text-on-surface-variant">Agendar cita con alumno</h2>
            <select name="student_id" required className="mt-4 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface">
              <option value="">Selecciona alumno</option>
              {(activeTeam.tutor_team_members ?? []).filter((member) => member.status === 'active').map((member) => (
                <option key={member.id} value={member.student_id}>{member.student?.profile?.full_name ?? member.student?.profile?.email ?? member.student_id}</option>
              ))}
            </select>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <input name="scheduled_date" type="date" min={new Date().toISOString().slice(0,10)} required className="rounded border border-outline-variant bg-surface px-2 py-2 text-xs text-on-surface" />
              <input name="starts_at" type="time" required className="rounded border border-outline-variant bg-surface px-2 py-2 text-xs text-on-surface" />
              <input name="ends_at" type="time" required className="rounded border border-outline-variant bg-surface px-2 py-2 text-xs text-on-surface" />
            </div>
            <textarea name="reason" required minLength={5} rows={3} placeholder="Motivo y objetivo de la cita" className="mt-3 w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" />
            <SubmitButton className="mt-3 rounded bg-primary px-4 py-2 text-sm font-bold text-on-primary" pendingLabel="Agendando...">Agendar y notificar</SubmitButton>
          </form>
        </section>
      ) : null}

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
              <SubmitButton className="rounded bg-primary px-4 py-2 text-sm font-bold text-on-primary disabled:opacity-60" pendingLabel="Enviando...">
                Enviar notificación
              </SubmitButton>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
