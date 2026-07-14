import { BulkStudentsUpload } from "@/components/modules/bulk-students-upload/bulk-students-upload";
import { requireRole } from "@/lib/auth/session";

export default async function BulkStudentsPage() {
  await requireRole(["admin"]);
  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <BulkStudentsUpload />
    </div>
  );
}
