import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { profileComplete, requirePageUser } from "@/lib/auth";
import { loadCategoryContext } from "@/lib/site/category-context";
import { fmtDate, fmtTime } from "@/lib/format";
import { ID_TYPE_LABEL, type IdType } from "@/lib/validation";
import { safeRichText } from "@/lib/site/sanitize";
import { ConfirmClaim } from "./confirm-claim";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Konfirmasi Klaim" };

export default async function ConfirmPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const u = await requirePageUser();
  const { categoryId } = await params;
  const ctx = await loadCategoryContext(categoryId);
  if (!ctx) notFound();
  const { event, cat, alternatives } = ctx;
  if (!profileComplete(u)) redirect(`/profil?next=${encodeURIComponent(`/event/${event.slug}`)}`);
  const [held] = await sql<{ id: string }[]>`
    SELECT id FROM tickets WHERE event_id = ${event.id} AND user_id = ${u.id} AND status IN ('ACTIVE','CHECKED_IN')`;

  return (
    <div className="mx-auto max-w-xl px-4 pb-8 pt-20 sm:pt-24">
      <ConfirmClaim
        categoryId={cat.id}
        slug={event.slug}
        heldTicketId={held?.id ?? null}
        summary={{
          eventName: event.name,
          categoryName: cat.name,
          categoryDescription: cat.description,
          categoryColor: cat.color,
          date: `${fmtDate(event.start_at, event.timezone)}, ${fmtTime(event.start_at, event.timezone)}`,
          venue: [event.venue, event.city].filter(Boolean).join(", "),
          banner: event.banner_url,
          holderName: u.full_name,
          idType: ID_TYPE_LABEL[(u.id_type ?? "KTP") as IdType] ?? u.id_type ?? "-",
          idLast4: u.id_last4 ?? "-",
          email: u.email,
          termsHtml: safeRichText(event.terms),
        }}
        alternatives={alternatives}
      />
    </div>
  );
}
