import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import { ParticipantAccounts } from "@/components/admin/participant-accounts";

export const metadata: Metadata = { title: "Akun Peserta" };

export default async function Page() {
  await requirePageUser(["EVENT_ADMIN", "SUPER_ADMIN"], "/admin/login");
  return <ParticipantAccounts />;
}
