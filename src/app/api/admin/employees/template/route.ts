import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { templateXlsx } from "@/lib/admin/employees";

/** GET /api/admin/employees/template — template impor data karyawan (.xlsx). */
export const GET = route(async () => {
  await requireAdmin();
  return new NextResponse(new Uint8Array(await templateXlsx()), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="template-data-karyawan.xlsx"`,
      "cache-control": "no-store",
    },
  });
});
