import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import { GamesLock } from "@/components/admin/games-lock";

export const metadata: Metadata = { title: "Games" };

export default async function Page() {
  await requirePageUser(["EVENT_ADMIN", "SUPER_ADMIN"], "/admin/login");
  return <GamesLock />;
}
