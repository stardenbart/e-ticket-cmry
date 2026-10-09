import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/sidebar";

export const metadata: Metadata = { title: { default: "Panel Admin", template: "%s · Admin" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const u = await requirePageUser(["EVENT_ADMIN", "SUPER_ADMIN"], "/admin/login");
  return (
    <div className="min-h-dvh bg-cimory-light lg:flex">
      <AdminSidebar superAdmin={u.role === "SUPER_ADMIN"} name={u.full_name} email={u.email} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
