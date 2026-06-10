/**
 * fieldEncryption.ts — AES-256-GCM field-level encryption for sensitive DB columns
 *
 * Covers: sk_live, pk_live (hosted_page_configs)
 * Lookup key hp_live uses HMAC-SHA256 for searchable hashing.
 *
 * Env var required: FIELD_ENCRYPTION_KEY (any string ≥ 16 chars)
 * Key is derived to 32 bytes via SHA-256 so any string length works.
 *
 * Ciphertext format (base64): "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 * Prefix "enc:" distinguishes encrypted values from legacy plaintext.
 */
import crypto from "crypto";

const ENCRYPTION_PREFIX = "enc:";
const ALGO = "aes-256-gcm";

function getDerivedKey(): Buffer | null {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw || raw.trim().length < 8) return null;
  return crypto.createHash("sha256").update(raw).digest();
}

function getHmacKey(): Buffer | null {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) return null;
  return crypto.createHash("sha256").update("hmac:" + raw).digest();
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 * Returns a prefixed ciphertext string, or the original value if no key is configured.
 */
export function encryptField(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined) return null;
  const key = getDerivedKey();
  if (!key) {
    console.warn("[FieldEncryption] FIELD_ENCRYPTION_KEY not set — storing field in cleartext");
    return plaintext;
  }
  if (plaintext.startsWith(ENCRYPTION_PREFIX)) return plaintext; // already encrypted
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv) as crypto.CipherGCM;
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${ENCRYPTION_PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a field encrypted by encryptField().
 * If value is not prefixed (legacy cleartext), returns as-is.
 */
export function decryptField(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (!value.startsWith(ENCRYPTION_PREFIX)) return value; // legacy plaintext — pass through
  const key = getDerivedKey();
  if (!key) {
    console.warn("[FieldEncryption] FIELD_ENCRYPTION_KEY not set — cannot decrypt field");
    return value; // return raw (non-functional but won't crash)
  }
  try {
    const payload = value.slice(ENCRYPTION_PREFIX.length);
    const [ivHex, authTagHex, ciphertextHex] = payload.split(":");
    if (!ivHex || !authTagHex || !ciphertextHex) throw new Error("Invalid format");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");
    const decipher = crypto.createDecipheriv(ALGO, key, iv, { authTagLength: 16 }) as crypto.DecipherGCM;
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
  } catch (err: any) {
    console.error("[FieldEncryption] Decryption failed:", err?.message);
    return null;
  }
}

/**
 * Computes a keyed HMAC-SHA256 of a value for searchable storage.
 * Used for hp_live lookup (bearer token) — allows DB lookup without storing plaintext.
 * Returns hex string.
 */
export function hmacField(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = getHmacKey();
  if (!key) {
    // No key: return SHA-256 of value as fallback (weaker but not null)
    return crypto.createHash("sha256").update(value).digest("hex");
  }
  return crypto.createHmac("sha256", key).update(value).digest("hex");
}

/**
 * Verifies a plaintext value against its stored HMAC hash.
 */
export function verifyHmacField(plaintext: string, storedHash: string): boolean {
  const computed = hmacField(plaintext);
  if (!computed) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
}
