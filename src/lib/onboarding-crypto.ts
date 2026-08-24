import crypto from "crypto";

// Optional encryption-at-rest for client-submitted onboarding credentials
// (registrar logins etc.). When ONBOARDING_ENCRYPTION_KEY (32-byte base64)
// is set in the environment, submissions are stored as
// "enc:v1:<iv>:<ciphertext>:<tag>" strings; without it they are stored as
// plain JSON objects. The "enc:v1:" prefix distinguishes the two on read,
// so the key can be added (or rotated off) without a data migration.

const PREFIX = "enc:v1:";

function getKey(): Buffer | null {
  const raw = process.env.ONBOARDING_ENCRYPTION_KEY;
  if (!raw) return null;
  try {
    const key = Buffer.from(raw, "base64");
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

export function encryptSubmission(obj: unknown): unknown {
  const key = getKey();
  if (!key) return obj;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(obj), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${ciphertext.toString("base64")}:${tag.toString("base64")}`;
}

export function decryptSubmission(stored: unknown): unknown {
  if (typeof stored !== "string" || !stored.startsWith(PREFIX)) return stored;
  const key = getKey();
  if (!key) return null;
  try {
    const [ivB64, ctB64, tagB64] = stored.slice(PREFIX.length).split(":");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ctB64, "base64")),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString("utf8"));
  } catch {
    return null;
  }
}
