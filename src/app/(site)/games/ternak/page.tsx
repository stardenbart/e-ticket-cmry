import type { Metadata } from "next";
import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { CATALOG, getFarm } from "@/lib/ternak/service";
import { FarmApp } from "@/components/ternak/farm-app";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ternak Sapi" };

export default async function TernakPage() {
  const u = await requirePageUser();
  const { farm, ended, notStarted } = await getFarm(u.id);
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-24 sm:pt-28">
      <Link href="/games" className="text-sm font-semibold text-[#19e6ff] hover:underline">
        ← Semua game
      </Link>
      <h1 className="mv-title mb-1 mt-1 text-2xl sm:text-3xl">Grow your Cow, Grow your Country</h1>
      <p className="mb-4 text-sm text-[#dbe4ff]">Rawat sapimu dengan Moo-coins hasil main games.</p>
      <FarmApp initial={farm} catalog={CATALOG} ended={ended} notStarted={notStarted} />
    </div>
  );
}
