import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import { Accounts } from "@/components/admin/accounts";

export const metadata: Metadata = { title: "Akun Admin" };

export default async function Page() {
  const u = await requirePageUser(["SUPER_ADMIN"], "/admin/login");
  return <Accounts meId={u.id} />;
}
