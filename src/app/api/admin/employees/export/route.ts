import { NextResponse } from "next/server";
import { clientIp, route } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { employeeEvents, exportEmployeesXlsx, queryEmployees } from "@/lib/admin/employees";

export const dynamic = "force-dynamic";

/** GET /api/admin/employees/export?eventId=&filter… — unduh .xlsx dengan kolom & filter yang sama seperti tabel admin. */
export const GET = route(async (req) => {
  const u = await requireAdmin();
  const sp = req.nextUrl.searchParams;
  const events = await employeeEvents();
  const eventId = events.find((e) => e.id === sp.get("eventId"))?.id ?? events[0]?.id ?? null;
  const f = { q: sp.get("q") ?? undefined, category: sp.get("category") ?? undefined, dept: sp.get("dept") ?? undefined, status: sp.get("status") ?? undefined, eventId };
  const { rows } = await queryEmployees(f);
  const buf = await exportEmployeesXlsx(rows);
  await audit({ actorId: u.id, action: "employees.export", entity: "employees", after: { ...f, rows: rows.length }, ip: clientIp(req) });
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="data-karyawan-${stamp}.xlsx"`,
      "cache-control": "no-store",
    },
  });
});
