// Buat pasangan kunci Ed25519 untuk tanda tangan QR + secret acak, lalu tulis ke .env (jika belum ada).
// Rotasi: jalankan dengan argumen kid baru, mis. `npm run keys -- 2`, lalu set QR_ACTIVE_KID=2.
// Kunci lama tetap disimpan agar tiket lama tetap valid sampai acara selesai.
import crypto from "node:crypto";
import fs from "node:fs";

const kid = Number(process.argv[2] ?? 1);
const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
const priv = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
const pubRaw = publicKey.export({ format: "jwk" }).x!; // base64url 32 byte

const envPath = ".env";
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : fs.readFileSync(".env.example", "utf8");
const setVar = (name: string, value: string, overwrite: boolean) => {
  const re = new RegExp(`^${name}=.*$`, "m");
  if (re.test(env)) {
    const current = env.match(re)![0].split("=").slice(1).join("=");
    if (!overwrite && current && current !== "change-me") return;
    env = env.replace(re, `${name}=${value}`);
  } else env += `\n${name}=${value}`;
};
setVar("IDENTITY_HMAC_SECRET", crypto.randomBytes(32).toString("base64url"), false);
setVar("APP_SECRET", crypto.randomBytes(32).toString("base64url"), false);
setVar(`QR_PRIVATE_KEY_${kid}`, priv, false);
setVar(`QR_PUBLIC_KEY_${kid}`, pubRaw, false);
fs.writeFileSync(envPath, env.endsWith("\n") ? env : env + "\n");
console.log(`.env diperbarui (kid ${kid}).`);
