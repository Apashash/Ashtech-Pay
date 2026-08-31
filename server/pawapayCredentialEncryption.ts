import crypto from "node:crypto";
import { decryptField } from "./fieldEncryption";

/**
 * PawaPay credentials use a dedicated envelope so they no longer depend on
 * FIELD_ENCRYPTION_KEY being configured in the deployment environment.
 *
 * SESSION_SECRET is already mandatory for production sessions. FIELD_ENCRYPTION_KEY
 * remains a fallback for development and for deployments that have not yet
 * moved their PawaPay credentials to this envelope.
 */
const PAWAPAY_ENCRYPTION_PREFIX = "enc:pawapay:v1:";
const PAWAPAY_KEY_CONTEXT = "ashtechpay:pawapay-credentials:v1:";
const ALGORITHM = "aes-256-gcm";

function getCandidateRawKeys(): string[] {
  const candidates = [process.env.SESSION_SECRET, process.env.FIELD_ENCRYPTION_KEY]
    .map((value) => value?.trim() || "")
    .filter((value) => value.length >= 8);
  return [...new Set(candidates)];
}

function deriveKey(rawKey: string): Buffer {
  return crypto.createHash("sha256").update(PAWAPAY_KEY_CONTEXT + rawKey).digest();
}

export function isPawaPayCredentialEncryptionConfigured(): boolean {
  return getCandidateRawKeys().length > 0;
}

export function encryptPawaPayCredential(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined) return null;
  const rawKey = getCandidateRawKeys()[0];
  if (!rawKey) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(rawKey), iv) as crypto.CipherGCM;
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PAWAPAY_ENCRYPTION_PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptDedicatedCredential(value: string): string | null {
  if (!value.startsWith(PAWAPAY_ENCRYPTION_PREFIX)) return null;
  const payload = value.slice(PAWAPAY_ENCRYPTION_PREFIX.length);
  const [ivHex, authTagHex, ciphertextHex] = payload.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) return null;

  for (const rawKey of getCandidateRawKeys()) {
    try {
      const decipher = crypto.createDecipheriv(
        ALGORITHM,
        deriveKey(rawKey),
        Buffer.from(ivHex, "hex"),
        { authTagLength: 16 },
      ) as crypto.DecipherGCM;
      decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
      return decipher.update(Buffer.from(ciphertextHex, "hex")).toString("utf8") + decipher.final("utf8");
    } catch {
      // Try the next configured key without revealing which key failed.
    }
  }
  return null;
}

export function readPawaPayStoredSecret(value: string | null | undefined): {
  value: string | null;
  legacy: boolean;
} {
  if (!value) return { value: null, legacy: false };

  if (value.startsWith(PAWAPAY_ENCRYPTION_PREFIX)) {
    return { value: decryptDedicatedCredential(value), legacy: false };
  }

  // Compatibility with plaintext values and the former FIELD_ENCRYPTION_KEY
  // envelope. A valid legacy value is migrated by pawapayConfig.ts.
  return { value: decryptField(value), legacy: true };
}