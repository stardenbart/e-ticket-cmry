import { Badge } from "@/components/ui";

export function TicketStatusBadge({ status, finished }: { status: string; finished?: boolean }) {
  if (status === "ACTIVE" && finished) return <Badge tone="slate" icon={<span aria-hidden>■</span>}>Acara selesai</Badge>;
  if (status === "ACTIVE") return <Badge tone="green" icon={<span aria-hidden>●</span>}>Aktif</Badge>;
  if (status === "CHECKED_IN") return <Badge tone="blue" icon={<span aria-hidden>✓</span>}>Sudah check-in</Badge>;
  if (status === "CANCELLED") return <Badge tone="red" icon={<span aria-hidden>✕</span>}>Dibatalkan</Badge>;
  return <Badge tone="red" icon={<span aria-hidden>✕</span>}>Dicabut</Badge>;
}
