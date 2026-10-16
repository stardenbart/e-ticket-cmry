import { NextResponse } from "next/server";
import { clientIp, route } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { exportParticipantAccountsXlsx, queryParticipantAccounts } from "@/lib/admin/participant-accounts";

export const dynamic = "force-dynamic";

/** GET /api/admin/participant-accounts/export?filter… — unduh .xlsx sesuai filter yang sedang dipakai. */
export const GET = route(async (req) => {
  const u = await requireAdmin();
  const sp = req.nextUrl.searchParams;
  const f = { q: sp.get("q") ?? undefined, link: sp.get("link") ?? undefined, ticket: sp.get("ticket") ?? undefined, state: sp.get("state") ?? undefined };
  const { rows } = await queryParticipantAccounts(f);
  const buf = await exportParticipantAccountsXlsx(rows);
  await audit({ actorId: u.id, action: "participant_accounts.export", entity: "users", after: { ...f, rows: rows.length }, ip: clientIp(req) });
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="akun-peserta-${stamp}.xlsx"`,
      "cache-control": "no-store",
    },
  });
});
