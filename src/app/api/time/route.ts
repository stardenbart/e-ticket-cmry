import { NextResponse } from "next/server";
import { serverNowMs } from "@/lib/redis";

export const dynamic = "force-dynamic";

/** Jam server untuk sinkronisasi countdown di klien. */
export async function GET() {
  return NextResponse.json({ now: await serverNowMs() }, { headers: { "cache-control": "no-store" } });
}
