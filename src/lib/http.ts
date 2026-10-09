import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { env } from "./env";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export const json = (data: unknown, init?: ResponseInit) => NextResponse.json(data, init);

export function errorResponse(e: ApiError) {
  return NextResponse.json({ error: { code: e.code, message: e.message, ...e.extra } }, { status: e.status });
}

type Ctx<P> = { params: Promise<P> };

/**
 * Bungkus route handler: cek Origin untuk request yang mengubah data (CSRF),
 * dan ubah ApiError / ZodError menjadi respons JSON yang konsisten.
 */
export function route<P = Record<string, string>>(fn: (req: NextRequest, ctx: Ctx<P>) => Promise<Response>) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        const origin = req.headers.get("origin");
        if (origin && !sameOrigin(origin, req)) throw new ApiError(403, "BAD_ORIGIN", "Origin tidak diizinkan.");
      }
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return errorResponse(e);
      if (e instanceof ZodError) {
        const first = e.issues[0];
        return errorResponse(
          new ApiError(400, "VALIDATION", first?.message ?? "Data tidak valid.", {
            fields: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          }),
        );
      }
      console.error(`[api] ${req.method} ${req.nextUrl.pathname}`, e);
      return errorResponse(new ApiError(500, "INTERNAL", "Terjadi kesalahan di server. Coba lagi."));
    }
  };
}

function sameOrigin(origin: string, req: NextRequest) {
  try {
    const o = new URL(origin);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return o.host === host || o.origin === new URL(env.APP_URL).origin;
  } catch {
    return false;
  }
}

export function clientIp(req: NextRequest | Request): string {
  const h = req.headers;
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0].trim() ??
    h.get("x-real-ip") ??
    "unknown"
  );
}

export async function body<T>(req: Request, schema: { parse: (v: unknown) => T }): Promise<T> {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    throw new ApiError(400, "BAD_JSON", "Body harus JSON.");
  }
  return schema.parse(data);
}
