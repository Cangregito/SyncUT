import { DashboardShell } from "@/components/layout/dashboard-shell";
import { hasPermission } from "@/lib/auth/roles";
import { requireProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  // El indicador de la campana se apoya en un conteo real. Antes estaba pintado
  // siempre, asi que no distinguia una bandeja vacia de una con avisos.
  let unreadCount = 0;

  if (hasPermission(profile.role, "notifications:view")) {
    const supabase = await createSupabaseServerClient();
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("is_read", false);

    unreadCount = count ?? 0;
  }

  return (
    <DashboardShell email={profile.email} role={profile.role} unreadCount={unreadCount}>
      {children}
    </DashboardShell>
  );
}
