import type { Metadata } from "next";
import { sql } from "@/lib/db";
import { profileComplete, requirePageUser } from "@/lib/auth";
import { PageHero } from "@/components/site/ornaments";
import { safeNext } from "@/components/site/auth-shell";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profil & Identitas" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requirePageUser();
  const sp = await searchParams;
  const [locked] = await sql`SELECT 1 FROM tickets WHERE user_id = ${u.id} AND status IN ('ACTIVE','CHECKED_IN') LIMIT 1`;
  const next = sp.next ? safeNext(sp.next, "/") : null;
  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-12 sm:pt-16">
      <PageHero title="Profil & Identitas" subtitle={u.email} />
      <ProfileForm
        initial={{ fullName: u.full_name, idType: (u.id_type as "KTP" | "SIM" | "PASPOR" | null) ?? null, idLast4: u.id_last4 }}
        complete={profileComplete(u)}
        locked={!!locked}
        next={next}
        isNew={sp.baru === "1"}
      />
    </div>
  );
}
