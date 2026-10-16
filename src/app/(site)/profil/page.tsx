import type { Metadata } from "next";
import { sql } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { findEmployee } from "@/lib/employees";
import { PageHero } from "@/components/site/ornaments";
import { safeNext } from "@/components/site/auth-shell";
import { PhoneCard, ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profil Karyawan" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requirePageUser();
  const sp = await searchParams;
  const [locked] = await sql`SELECT 1 FROM tickets WHERE user_id = ${u.id} AND status IN ('ACTIVE','CHECKED_IN') LIMIT 1`;
  const emp = u.nik ? await findEmployee(u.nik) : null;
  const next = sp.next ? safeNext(sp.next, "/") : null;
  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-12 sm:pt-16">
      <PageHero title="Profil Karyawan" subtitle={u.email} />
      <ProfileForm
        linked={u.nik ? { nik: u.nik, name: u.full_name, dept: emp?.dept ?? null, category: emp?.category ?? null, eligible: !!emp } : null}
        locked={!!locked}
        next={next}
      />
      <PhoneCard phone={u.phone} />
    </div>
  );
}
