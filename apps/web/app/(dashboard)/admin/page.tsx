import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ExecutiveDashboardPage } from "@/components/modules/executive-dashboard/executive-dashboard-page";
import { requireRole } from "@/lib/auth/session";
import { ROLE_LABELS, USER_ROLES, type UserRole } from "@/lib/auth/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getAuthRedirectUrl } from "@/lib/auth/urls";

const STAFF_ROLES = ["teacher", "tutor"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && STAFF_ROLES.includes(value as StaffRole);
}

function normalizeStaffEmail(email: string): string {
  return email.trim().toLowerCase();
}

function buildEmployeeCode(email: string): string {
  const prefix = email.split("@")[0]?.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `UTCJ-${prefix || crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

async function inviteStaffAccount(formData: FormData) {
  "use server";

  await requireRole(["admin"]);

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = normalizeStaffEmail(String(formData.get("email") ?? ""));
  const roleValue = String(formData.get("role") ?? "");
  const department = String(formData.get("department") ?? "").trim() || "UTCJ";

  if (!fullName || !email || !isStaffRole(roleValue)) {
    redirect("/admin?staff_error=missing");
  }

  if (!email.endsWith("@utcj.edu.mx")) {
    redirect("/admin?staff_error=email");
  }

  const serviceSupabase = createSupabaseServiceRoleClient();
  const { data: existingProfile } = await serviceSupabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  let userId = existingProfile?.id ?? null;

  if (!userId) {
    const { data, error } = await serviceSupabase.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName,
        role: roleValue,
      },
      redirectTo: getAuthRedirectUrl("/auth/callback?next=/dashboard"),
    });

    if (error || !data.user) {
      redirect(`/admin?staff_error=${encodeURIComponent(error?.message ?? "invite")}`);
    }

    userId = data.user.id;
  }

  await serviceSupabase.from("profiles").upsert({
    id: userId,
    email,
    full_name: fullName,
    role: roleValue,
    updated_at: new Date().toISOString(),
  });

  if (roleValue === "teacher" || roleValue === "tutor") {
    await serviceSupabase.from("teachers").upsert({
      id: userId,
      employee_code: buildEmployeeCode(email),
      department,
      specialization: roleValue === "tutor" ? ["Tutoría académica"] : ["Docencia"],
      updated_at: new Date().toISOString(),
    });
  }

  const notificationTitle = "Cuenta institucional activada";
  const notificationBody = `Tu cuenta fue registrada como ${ROLE_LABELS[roleValue]}. Revisa tu correo para activar el acceso.`;
  const { data: notification } = await serviceSupabase.from("notifications").insert({
    user_id: userId,
    event_type: "staff.invited",
    title: notificationTitle,
    body: notificationBody,
    metadata: { role: roleValue, department },
  }).select("id").maybeSingle();

  const { data: queuedEmail } = await serviceSupabase.from("email_queue").insert({
    user_id: userId,
    to_email: email,
    subject: notificationTitle,
    template_slug: "staff-invited",
    template_data: {
      title: notificationTitle,
      body: notificationBody,
      metadata: { role: roleValue, department },
    },
  }).select("id").maybeSingle();

  await serviceSupabase.from("notification_logs").insert({
    event_type: "staff.invited",
    user_id: userId,
    notification_id: notification?.id ?? null,
    email_queue_id: queuedEmail?.id ?? null,
    triggered_by: null,
    payload: {
      title: notificationTitle,
      body: notificationBody,
      metadata: { role: roleValue, department },
    },
  });

  revalidatePath("/admin");
  redirect("/admin?staff_created=true");
}

export default async function AdminRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ staff_created?: string; staff_error?: string }>;
}) {
  await requireRole(["admin"]);
  const params = await searchParams;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section className="rounded-lg border border-outline-variant bg-surface-container p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Gobernanza de cuentas</p>
            <h1 className="mt-2 text-2xl font-headline font-bold text-on-surface">Alta institucional de staff</h1>
            <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
              Docentes y tutores se agregan desde aquí. El registro público queda reservado para alumnos con correo institucional.
            </p>
          </div>
          <span className="rounded border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant">
            Roles permitidos: {STAFF_ROLES.map((role) => ROLE_LABELS[role]).join(", ")}
          </span>
        </div>

        {params.staff_created ? (
          <p className="mt-4 rounded border border-tertiary/40 bg-tertiary-container/20 p-3 text-sm font-semibold text-on-tertiary-container">
            Cuenta de staff registrada. Si era nueva, Supabase envió la invitación al correo institucional.
          </p>
        ) : null}

        {params.staff_error ? (
          <p className="mt-4 rounded border border-error/40 bg-error-container/20 p-3 text-sm font-semibold text-on-error-container">
            No se pudo registrar la cuenta. Verifica nombre, rol y correo @utcj.edu.mx.
          </p>
        ) : null}

        <form action={inviteStaffAccount} className="mt-5 grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-on-surface-variant" htmlFor="full_name">
              Nombre
            </label>
            <input
              id="full_name"
              name="full_name"
              className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
              placeholder="Nombre completo"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-on-surface-variant" htmlFor="email">
              Correo institucional
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
              placeholder="docente@utcj.edu.mx"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-on-surface-variant" htmlFor="role">
              Rol
            </label>
            <select id="role" name="role" className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" required>
              {USER_ROLES.filter((role): role is UserRole & StaffRole => isStaffRole(role)).map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-on-surface-variant" htmlFor="department">
              Área
            </label>
            <input
              id="department"
              name="department"
              className="w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
              placeholder="Departamento"
            />
          </div>
          <div className="md:col-span-4">
            <button className="rounded bg-primary px-4 py-2 text-sm font-bold text-on-primary">
              Invitar o actualizar cuenta
            </button>
          </div>
        </form>
      </section>

      <ExecutiveDashboardPage />
    </div>
  );
}
