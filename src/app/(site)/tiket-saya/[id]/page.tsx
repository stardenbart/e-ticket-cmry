import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { cancelDeadline, getTicket } from "@/lib/tickets";
import { fmtDate, fmtDateTime, fmtTime } from "@/lib/format";
import { ID_TYPE_LABEL, type IdType } from "@/lib/validation";
import { Alert, Card } from "@/components/ui";
import { TicketStatusBadge } from "@/components/site/ticket-status";
import { TicketActions } from "./ticket-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Detail Tiket" };

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requirePageUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = await getTicket(id);
  if (!t || t.user_id !== u.id) notFound();

  const now = Date.now();
  const finished = t.end_at.getTime() <= now;
  const usable = (t.status === "ACTIVE" || t.status === "CHECKED_IN") && !finished;
  const deadline = cancelDeadline(t);
  const canCancel = t.status === "ACTIVE" && now < deadline.getTime();
  const nearEvent = now >= t.start_at.getTime() - 24 * 3600_000 && !finished;
  const idType = ID_TYPE_LABEL[t.id_type as IdType] ?? t.id_type;

  return (
    <div className="mx-auto max-w-lg px-4 pb-8 pt-20 sm:pt-24">
      <Link href="/tiket-saya" className="mb-4 inline-block text-sm font-semibold text-cimory-blue hover:underline">
        ← Tiket Saya
      </Link>

      {nearEvent && t.status === "ACTIVE" && (
        <Alert tone="red" title="Jangan bagikan foto QR ini" className="mb-4">
          QR bersifat pribadi. Orang lain yang memakai foto QR Anda akan ditolak karena identitasnya dicocokkan di gate — dan tiket Anda bisa ikut bermasalah.
        </Alert>
      )}

      <Card className="overflow-hidden">
        <div className="bg-cimory-gradient px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">E-Ticket</p>
              <h1 className="text-2xl leading-snug">{t.event_name}</h1>
            </div>
            <span className="rounded-full bg-[#07081f]/70 px-1 py-0.5">
              <TicketStatusBadge status={t.status} finished={finished} />
            </span>
          </div>
        </div>

        <TicketActions
          ticketId={t.id}
          usable={usable}
          status={t.status}
          canCancel={canCancel}
          deadlineText={fmtDateTime(deadline, t.timezone)}
          holderName={t.holder_name}
          eventName={t.event_name}
          emailStatus={t.email_status}
          email={t.email}
        />

        <dl className="grid grid-cols-2 gap-4 border-t border-dashed border-line p-5 text-sm">
          <div className="col-span-2">
            <dt className="text-muted">Nama pemegang</dt>
            <dd className="font-display text-xl font-extrabold text-white">{t.holder_name}</dd>
          </div>
          <div>
            <dt className="text-muted">Kategori</dt>
            <dd className="flex items-center gap-1.5 font-semibold">
              <span className="size-2.5 rounded-full" style={{ background: t.category_color }} aria-hidden />
              {t.category_name}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Identitas</dt>
            <dd className="font-semibold">
              {idType} •••• {t.id_last4 ?? "—"}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted">Tanggal</dt>
            <dd className="font-semibold">
              {fmtDate(t.start_at, t.timezone)}, {fmtTime(t.start_at, t.timezone)} – {fmtTime(t.end_at, t.timezone)}
            </dd>
            {t.gate_open_at && <dd className="text-muted">Gate dibuka {fmtTime(t.gate_open_at, t.timezone)}</dd>}
          </div>
          <div className="col-span-2">
            <dt className="text-muted">Lokasi</dt>
            <dd className="font-semibold">{t.venue}</dd>
            <dd className="text-muted">{[t.address, t.city].filter(Boolean).join(", ")}</dd>
          </div>
          {t.status === "CHECKED_IN" && t.checked_in_at && (
            <div className="col-span-2 rounded-xl bg-blue-50 p-3 text-cimory-blue ring-1 ring-blue-200">
              ✓ Check-in {fmtDateTime(t.checked_in_at, t.timezone)}
              {t.checked_in_gate ? ` di ${t.checked_in_gate}` : ""}
            </div>
          )}
          {t.status === "CANCELLED" && (
            <div className="col-span-2 rounded-xl bg-red-50 p-3 text-slate-800 ring-1 ring-red-200">
              Tiket dibatalkan{t.cancelled_at ? ` pada ${fmtDateTime(t.cancelled_at, t.timezone)}` : ""}. QR tidak berlaku.
            </div>
          )}
          <div className="col-span-2">
            <dt className="text-muted">ID tiket</dt>
            <dd className="break-all font-mono text-xs">{t.id}</dd>
          </div>
        </dl>
      </Card>

      <p className="mt-4 text-center text-sm text-muted">
        Bawa <b>{idType} asli</b> yang sama dengan data di tiket. Tiket tidak dapat dipindahtangankan.{" "}
        <Link href={`/event/${t.event_slug}`} className="font-semibold text-cimory-blue underline">
          Halaman event
        </Link>
      </p>
    </div>
  );
}
