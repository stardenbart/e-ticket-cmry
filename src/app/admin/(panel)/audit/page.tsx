import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { AuditViewer } from "@/components/admin/audit-viewer";

export const metadata: Metadata = { title: "Audit Log" };

export default async function Page() {
  const u = await currentUser();
  return <AuditViewer superAdmin={u?.role === "SUPER_ADMIN"} />;
}
