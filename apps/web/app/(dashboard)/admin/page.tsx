import { ExecutiveDashboardPage } from "@/components/modules/executive-dashboard/executive-dashboard-page";
import { requireRole } from "@/lib/auth/session";

export default async function AdminRoutePage() {
  await requireRole(["admin"]);
  return <ExecutiveDashboardPage />;
}
