function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const env = {
  get DATABASE_URL() { return req("DATABASE_URL"); },
  get REDIS_URL() { return req("REDIS_URL"); },
  get APP_URL() { return process.env.APP_URL ?? "http://localhost:3100"; },
  get IDENTITY_HMAC_SECRET() { return req("IDENTITY_HMAC_SECRET"); },
  get APP_SECRET() { return req("APP_SECRET"); },
  get QR_ACTIVE_KID() { return Number(process.env.QR_ACTIVE_KID ?? "1"); },
  qrPrivateKey(kid: number) { return process.env[`QR_PRIVATE_KEY_${kid}`]; },
  qrPublicKey(kid: number) { return process.env[`QR_PUBLIC_KEY_${kid}`]; },
  get TURNSTILE_SECRET_KEY() { return process.env.TURNSTILE_SECRET_KEY ?? ""; },
  get ADMIN_ALERT_EMAIL() { return process.env.ADMIN_ALERT_EMAIL ?? ""; },
  get isProd() { return process.env.NODE_ENV === "production"; },
  /** Cookie Secure; default aktif di produksi. Set COOKIE_SECURE=false hanya untuk deployment HTTP internal. */
  get COOKIE_SECURE() { return process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production"; },
};
