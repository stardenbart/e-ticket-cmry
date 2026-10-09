import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import { BlockedDomains } from "@/components/admin/blocked-domains";

export const metadata: Metadata = { title: "Blokir Domain Email" };

export default async function Page() {
  await requirePageUser(["SUPER_ADMIN"], "/admin/login");
  return <BlockedDomains />;
}
