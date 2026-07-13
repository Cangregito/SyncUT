import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Activity, ArrowUpRight, GraduationCap, KeyRound, ShieldCheck, UserPlus, Users } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { ROLE_LABELS, USER_ROLES, type UserRole } from "@/lib/auth/roles";
import { getAuthRedirectUrl } from "@/lib/auth/urls";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const STAFF_ROLES = ["teacher", "tutor"] as const;
const ROLE_COLORS: Record<UserRole, string> = {
  student: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  teacher: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  tutor: "border-violet-400/20 bg-violet-400/10 text-violet-300",
  admin: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
};

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}

function employeeCode(email: string) {
  return `UTCJ-${email.split("@")[0]?.replace(/[^a-z0-9]/gi, "").toUpperCase() || crypto.randomUUID().slice(0, 8)}`;
}

function isValidStaffEmail(email: string, role: string) {
  if (role === "teacher") {
    return /^[a-z0-9]+(?:[._-][a-z0-9]+)*@(utcjedu\.onmicrosoft\.com|utcj\.edu\.mx)$/i.test(email);
  }
  if (role === "tutor") {
    return /^[a-z0-9]+(?:[._-][a-z0-9]+)*@utcj\.edu\.mx$/i.test(email);
  }
  return false;
}

async function inviteStaffAccount(formData: FormData) {
  "use server";
  const actor = await requireRole(["admin"]);
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");
  const department = String(formData.get("department") ?? "").trim() || "UTCJ";
  if (!fullName || !email || !STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number])) redirect("/admin?error=missing");
  if (!isValidStaffEmail(email, role)) redirect(`/admin?error=${role === "teacher" ? "teacher_email" : "tutor_email"}`);

  const db = createSupabaseServiceRoleClient();
  const { data: existing } = await db.from("profiles").select("id,role").eq("email", email).maybeSingle();
  let userId = existing?.id;
  if (!userId) {
    const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, role },
      redirectTo: getAuthRedirectUrl("/auth/callback?next=/dashboard"),
    });
    if (error || !data.user) redirect(`/admin?error=${encodeURIComponent(error?.message ?? "invite")}`);
    userId = data.user.id;
  }
  const { error: profileError } = await db.from("profiles").upsert({
    id: userId, email, full_name: fullName, role, updated_at: new Date().toISOString(),
  });
  if (profileError) redirect(`/admin?error=${encodeURIComponent(profileError.message)}`);
  await db.from("teachers").upsert({
    id: userId, employee_code: employeeCode(email), department,
    specialization: role === "tutor" ? ["Tutoría académica"] : ["Docencia"], updated_at: new Date().toISOString(),
  });
  await db.from("audit_logs").insert({
    user_id: actor.id, action: existing ? "STAFF_UPDATED" : "STAFF_INVITED", table_name: "profiles", record_id: userId,
    old_values: existing ? { role: existing.role } : null, new_values: { email, full_name: fullName, role, department },
    result: "success", reason: "Alta institucional de personal", severity: "warning", request_id: crypto.randomUUID(),
  });
  revalidatePath("/admin");
  redirect("/admin?success=invited");
}

async function updateUserRole(formData: FormData) {
  "use server";
  const actor = await requireRole(["admin"]);
  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const confirmed = formData.get("confirmed") === "yes";
  if (!userId || !isUserRole(role) || userId === actor.id || reason.length < 8 || !confirmed) redirect("/admin?error=confirmation");
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("admin_change_user_role", { target_user_id: userId, new_role: role, change_reason: reason });
  if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin");
  redirect("/admin?success=role");
}

async function updateAccountStatus(formData: FormData) {
  "use server";
  const actor = await requireRole(["admin"]);
  const userId = String(formData.get("user_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!userId || userId === actor.id || !["active", "suspended", "deactivated"].includes(status) || reason.length < 8) redirect("/admin?error=confirmation");
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("admin_set_account_status", { target_user_id: userId, new_status: status, change_reason: reason });
  if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  const service = createSupabaseServiceRoleClient();
  const { error: authError } = await service.auth.admin.updateUserById(userId, {
    ban_duration: status === "active" ? "none" : "876000h",
  });
  if (authError) redirect(`/admin?error=${encodeURIComponent(authError.message)}`);
  revalidatePath("/admin");
  redirect("/admin?success=status");
}

function relativeDate(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "Ahora mismo";
  if (minutes < 60) return `Hace ${minutes} min`;
  if (minutes < 1440) return `Hace ${Math.floor(minutes / 60)} h`;
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default async function AdminRoutePage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string; q?: string; role?: string }> }) {
  const current = await requireRole(["admin"]);
  const params = await searchParams;
  const db = await createSupabaseServerClient();
  const [{ data: profileRows, error: profilesError }, { data: logRows, error: logsError }] = await Promise.all([
    db.from("profiles").select("id,email,full_name,role,account_status,status_reason,created_at,updated_at").order("created_at", { ascending: false }),
    db.from("audit_logs").select("id,user_id,action,table_name,record_id,old_values,new_values,created_at,result,reason,severity").order("created_at", { ascending: false }).limit(60),
  ]);
  const profiles = profileRows ?? [];
  const logs = logRows ?? [];
  const q = (params.q ?? "").trim().toLowerCase();
  const roleFilter = isUserRole(params.role) ? params.role : "all";
  const visible = profiles.filter((p) => (!q || p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)) && (roleFilter === "all" || p.role === roleFilter));
  const names = new Map(profiles.map((p) => [p.id, p.full_name]));
  const counts = Object.fromEntries(USER_ROLES.map((role) => [role, profiles.filter((p) => p.role === role).length]));
  const metrics = [
    { label: "Usuarios totales", value: profiles.length, icon: Users, tone: "text-violet-300 bg-violet-400/10" },
    { label: "Docentes", value: counts.teacher, icon: GraduationCap, tone: "text-amber-300 bg-amber-400/10" },
    { label: "Tutores activos", value: counts.tutor, icon: KeyRound, tone: "text-sky-300 bg-sky-400/10" },
    { label: "Eventos auditados", value: logs.length, icon: Activity, tone: "text-emerald-300 bg-emerald-400/10" },
  ];

  return <main className="mx-auto flex max-w-[1500px] flex-col gap-6 pb-12">
    {(profilesError || logsError) && <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-300">No fue posible cargar {profilesError ? 'los usuarios' : 'la bitácora'}: {(profilesError ?? logsError)?.message}</div>}
    <section className="relative overflow-hidden rounded-2xl border border-violet-400/15 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,.2),transparent_40%),linear-gradient(135deg,#15131b,#0d0d10)] p-6 md:p-8">
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[.18em] text-violet-300"><ShieldCheck size={14}/> Centro de gobernanza</div>
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-white md:text-4xl">Usuarios, roles y seguridad<br/><span className="text-violet-300">en un solo lugar.</span></h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Da de alta al personal, promueve docentes a tutores y conserva evidencia auditable de cada cambio.</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3"><div className="grid size-10 place-items-center rounded-lg bg-emerald-400/10 text-emerald-300"><ShieldCheck size={20}/></div><div><p className="text-xs text-zinc-500">Sesión protegida</p><p className="text-sm font-semibold text-zinc-200">{current.fullName}</p></div></div>
      </div>
    </section>

    {params.success && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-300">{params.success === "role" ? "Rol y privilegios actualizados correctamente." : params.success === "status" ? "Estado de cuenta actualizado y sesiones revocadas cuando correspondía." : "Cuenta de personal registrada e invitación procesada."}</div>}
    {params.error && <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-300">{params.error === "teacher_email" ? "El docente debe usar un correo @utcjedu.onmicrosoft.com o @utcj.edu.mx." : params.error === "tutor_email" ? "El tutor debe usar un correo @utcj.edu.mx." : "No se pudo completar la acción. Verifica los datos y vuelve a intentarlo."}</div>}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({ label, value, icon: Icon, tone }) => <article key={label} className="rounded-2xl border border-white/[.07] bg-zinc-950/60 p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-2 text-3xl font-bold text-white">{value}</p></div><div className={`grid size-10 place-items-center rounded-xl ${tone}`}><Icon size={20}/></div></div></article>)}
    </section>

    <section className="grid gap-6 xl:grid-cols-[.85fr_1.65fr]">
      <article className="rounded-2xl border border-white/[.07] bg-zinc-950/60 p-5 md:p-6">
        <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-violet-400/10 text-violet-300"><UserPlus size={20}/></div><div><h2 className="font-bold text-white">Agregar personal</h2><p className="text-xs text-zinc-500">Invitación segura por correo institucional</p></div></div>
        <form action={inviteStaffAccount} className="mt-6 space-y-4">
          {[['full_name','Nombre completo','Ej. Ana Martínez','text'],['email','Correo institucional','nombre_apellido@utcjedu.onmicrosoft.com','email'],['department','Área o departamento','Ej. Tecnologías de la Información','text']].map(([name,label,placeholder,type]) => <label key={name} className="block"><span className="mb-1.5 block text-xs font-semibold text-zinc-400">{label}</span><input name={name} type={type} placeholder={placeholder} required={name !== 'department'} className="w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/10"/>{name === 'email' ? <span className="mt-1.5 block text-[11px] text-zinc-500">Docente: @utcjedu.onmicrosoft.com o @utcj.edu.mx · Tutor: @utcj.edu.mx</span> : null}</label>)}
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-zinc-400">Rol inicial</span><select name="role" className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-3 text-sm text-white outline-none focus:border-violet-400/60"><option value="teacher">Docente</option><option value="tutor">Tutor</option></select></label>
          <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-400">Enviar invitación <ArrowUpRight size={16}/></button>
        </form>
      </article>

      <article className="overflow-hidden rounded-2xl border border-white/[.07] bg-zinc-950/60">
        <div className="border-b border-white/[.07] p-5 md:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-bold text-white">Directorio de usuarios</h2><p className="mt-1 text-xs text-zinc-500">Administra roles y privilegios de {profiles.length} cuentas</p></div><form className="flex gap-2"><input name="q" defaultValue={params.q} placeholder="Buscar nombre o correo…" className="min-w-0 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-violet-400/60"/><select name="role" defaultValue={roleFilter} className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-zinc-300"><option value="all">Todos</option>{USER_ROLES.map(r=><option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select><button className="rounded-lg border border-white/10 px-3 text-xs font-semibold text-zinc-300">Filtrar</button></form></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="bg-white/[.025] text-[11px] uppercase tracking-wider text-zinc-500"><tr><th className="px-6 py-3 font-semibold">Usuario</th><th className="px-4 py-3 font-semibold">Rol actual</th><th className="px-4 py-3 font-semibold">Alta</th><th className="px-6 py-3 text-right font-semibold">Privilegios</th></tr></thead><tbody className="divide-y divide-white/[.06]">
          {visible.map(user => <tr key={user.id} className="group align-top hover:bg-white/[.025]">
            <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500/30 to-sky-500/20 text-xs font-bold text-violet-200">{user.full_name.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()}</div><div><p className="text-sm font-semibold text-zinc-200">{user.full_name}{user.id === current.id && <span className="ml-2 text-[10px] text-zinc-500">TÚ</span>}</p><p className="text-xs text-zinc-500">{user.email}</p><span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${user.account_status === 'active' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-red-400/10 text-red-300'}`}>{user.account_status === 'active' ? 'ACTIVA' : user.account_status.toUpperCase()}</span></div></div></td>
            <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${ROLE_COLORS[user.role as UserRole] ?? ROLE_COLORS.student}`}>{ROLE_LABELS[user.role as UserRole] ?? user.role}</span></td>
            <td className="px-4 py-4 text-xs text-zinc-500">{user.created_at ? new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(user.created_at)) : 'Sin fecha'}</td>
            <td className="px-6 py-4"><div className="ml-auto grid max-w-sm gap-2">
              <form action={updateUserRole} className="grid grid-cols-[1fr_1.4fr_auto] gap-2"><input type="hidden" name="user_id" value={user.id}/><select name="role" defaultValue={user.role} disabled={user.id===current.id} aria-label={`Rol de ${user.full_name}`} className="rounded-lg border border-white/10 bg-zinc-950 px-2 py-2 text-xs text-zinc-300 disabled:opacity-40">{USER_ROLES.map(r=><option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select><input name="reason" minLength={8} required placeholder="Motivo del cambio" disabled={user.id===current.id} className="rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-xs text-white disabled:opacity-40"/><button name="confirmed" value="yes" disabled={user.id===current.id} className="rounded-lg bg-violet-500/80 px-3 py-2 text-xs font-semibold text-white disabled:opacity-30">Cambiar rol</button></form>
              <form action={updateAccountStatus} className="grid grid-cols-[1fr_1.4fr_auto] gap-2"><input type="hidden" name="user_id" value={user.id}/><select name="status" defaultValue={user.account_status} disabled={user.id===current.id} className="rounded-lg border border-white/10 bg-zinc-950 px-2 py-2 text-xs text-zinc-300 disabled:opacity-40"><option value="active">Activa</option><option value="suspended">Suspendida</option><option value="deactivated">Desactivada</option></select><input name="reason" minLength={8} required placeholder="Motivo del estado" disabled={user.id===current.id} className="rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-xs text-white disabled:opacity-40"/><button disabled={user.id===current.id} className="rounded-lg bg-white/[.07] px-3 py-2 text-xs font-semibold text-zinc-200 disabled:opacity-30">Aplicar</button></form>
            </div></td>
          </tr>)}
          {visible.length === 0 && <tr><td colSpan={4} className="px-6 py-12 text-center text-sm text-zinc-500">No encontramos usuarios con esos filtros.</td></tr>}
        </tbody></table></div>
      </article>
    </section>

    <section className="rounded-2xl border border-white/[.07] bg-zinc-950/60 p-5 md:p-6"><div className="flex items-center justify-between"><div><h2 className="flex items-center gap-2 font-bold text-white"><Activity size={18} className="text-emerald-300"/> Actividad y bitácora</h2><p className="mt-1 text-xs text-zinc-500">Últimos eventos administrativos y operativos registrados</p></div><span className="flex items-center gap-2 text-xs font-semibold text-emerald-300"><span className="size-2 animate-pulse rounded-full bg-emerald-400"/> Auditoría activa</span></div>
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{logs.map(log => { const values = (log.new_values ?? {}) as Record<string, unknown>; return <article key={log.id} className="rounded-xl border border-white/[.06] bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><div className="flex gap-2"><span className="rounded-md bg-white/[.06] px-2 py-1 text-[10px] font-bold tracking-wider text-zinc-300">{log.action.replaceAll('_',' ')}</span><span className={`rounded-md px-2 py-1 text-[10px] font-bold ${log.severity === 'critical' ? 'bg-red-400/10 text-red-300' : log.severity === 'warning' ? 'bg-amber-400/10 text-amber-300' : 'bg-emerald-400/10 text-emerald-300'}`}>{log.result.toUpperCase()}</span></div><time className="text-[11px] text-zinc-600">{relativeDate(log.created_at)}</time></div><p className="mt-3 text-sm font-semibold text-zinc-200">{String(values.full_name ?? values.email ?? log.table_name)}</p><p className="mt-1 text-xs text-zinc-500">Realizado por {names.get(log.user_id ?? '') ?? 'Sistema'} · {log.table_name}</p>{values.role ? <p className="mt-3 text-xs text-zinc-400">Nuevo rol: <span className="font-semibold text-violet-300">{ROLE_LABELS[values.role as UserRole] ?? String(values.role)}</span></p> : null}{log.reason ? <p className="mt-2 border-l-2 border-white/10 pl-2 text-xs text-zinc-400">{log.reason}</p> : null}</article>})}{logs.length===0 && <p className="col-span-full py-8 text-center text-sm text-zinc-500">Aún no hay eventos registrados.</p>}</div>
    </section>

  </main>;
}
