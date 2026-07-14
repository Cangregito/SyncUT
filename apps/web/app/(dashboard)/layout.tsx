import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireProfile } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  return (
    <DashboardShell email={profile.email} role={profile.role}>
      {children}
    </DashboardShell>
  );
}
