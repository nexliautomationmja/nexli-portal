import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.ORGANIZER_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ORGANIZER_ENCRYPTION_KEY environment variable is required");
  }
  // Accept hex (64 chars) or base64 (44 chars) key
  if (key.length === 64) return Buffer.from(key, "hex");
  return crypto.createHash("sha256").update(key).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a hex string: iv + authTag + ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // Pack: iv (16) + authTag (16) + ciphertext
  return Buffer.concat([iv, authTag, encrypted]).toString("hex");
}

/**
 * Decrypt a hex string produced by encrypt().
 */
export function decrypt(cipherHex: string): string {
  const key = getKey();
  const data = Buffer.from(cipherHex, "hex");
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

/** Fields that require encryption before storage */
const SENSITIVE_FIELDS = new Set([
  "ssn", "itin", "ein", "id_number",
  "spouse_ssn", "spouse_itin", "spouse_id_number",
  "routing_number", "account_number",
]);

/**
 * Encrypt sensitive fields in a section data object.
 * Returns a new object with sensitive values encrypted.
 */
export function encryptSectionData(
  data: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_FIELDS.has(key) && typeof value === "string" && value.length > 0) {
      result[key] = `ENC:${encrypt(value)}`;
    } else if (key === "dependents" && Array.isArray(value)) {
      // Encrypt SSN within dependent entries
      result[key] = value.map((dep: Record<string, unknown>) => {
        const d = { ...dep };
        if (typeof d.ssn === "string" && d.ssn.length > 0) {
          d.ssn = `ENC:${encrypt(d.ssn)}`;
        }
        return d;
      });
    } else if (
      (key === "officers" || key === "beneficiaries") &&
      Array.isArray(value)
    ) {
      result[key] = value.map((item: Record<string, unknown>) => {
        const d = { ...item };
        if (typeof d.ssn === "string" && d.ssn.length > 0) {
          d.ssn = `ENC:${encrypt(d.ssn)}`;
        }
        return d;
      });
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Decrypt sensitive fields in a section data object.
 */
export function decryptSectionData(
  data: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string" && value.startsWith("ENC:")) {
      try {
        result[key] = decrypt(value.slice(4));
      } catch {
        result[key] = "••••••••"; // fallback if decryption fails
      }
    } else if (
      (key === "dependents" || key === "officers" || key === "beneficiaries") &&
      Array.isArray(value)
    ) {
      result[key] = value.map((item: Record<string, unknown>) => {
        const d = { ...item };
        if (typeof d.ssn === "string" && d.ssn.startsWith("ENC:")) {
          try {
            d.ssn = decrypt((d.ssn as string).slice(4));
          } catch {
            d.ssn = "••••••••";
          }
        }
        return d;
      });
    } else {
      result[key] = value;
    }
  }
  return result;
}
