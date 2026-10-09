import { NextResponse } from "next/server";
import { z } from "zod";
import { route, clientIp } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { csvCell, loadEventOr404 } from "@/lib/admin/events";
import { queryParticipants } from "@/lib/admin/participants";

export const dynamic = "force-dynamic";

const STATUS_ID: Record<string, string> = { ACTIVE: "Aktif", CHECKED_IN: "Sudah check-in", CANCELLED: "Batal", REVOKED: "Dicabut" };

/** Export CSV peserta (tanpa nomor identitas). Tercatat di audit log. */
export const GET = route<{ id: string }>(async (req, ctx) => {
  const u = await requireAdmin();
  const { id } = await ctx.params;
  const e = await loadEventOr404(id);
  const sp = req.nextUrl.searchParams;
  const categoryId = sp.get("category") || undefined;
  if (categoryId) z.string().uuid().parse(categoryId);
  const filters = { q: sp.get("q") ?? undefined, status: sp.get("status") || undefined, categoryId };
  const { rows } = await queryParticipants(id, filters);
  const header = ["ticket_id", "nama_pemegang", "email", "kategori", "status", "jenis_identitas", "diterbitkan", "check_in", "gate", "status_email"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [r.id, r.holder_name, r.email, r.category_name, STATUS_ID[r.status] ?? r.status, r.id_type, r.issued_at, r.checked_in_at, r.checked_in_gate, r.email_status]
        .map(csvCell)
        .join(","),
    );
  }
  await audit({ actorId: u.id, action: "participants.export", entity: "event", entityId: id, after: { ...filters, rows: rows.length }, ip: clientIp(req) });
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="peserta-${e.slug}.csv"`,
      "cache-control": "no-store",
    },
  });
});
