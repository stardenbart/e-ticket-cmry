import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import { Employees } from "@/components/admin/employees";

export const metadata: Metadata = { title: "Data Karyawan" };

export default async function Page() {
  await requirePageUser(["EVENT_ADMIN", "SUPER_ADMIN"], "/admin/login");
  return <Employees />;
}
