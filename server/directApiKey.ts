import { decryptField } from "./fieldEncryption";

export type DirectApiKeyResolution =
  | { kind: "missing" }
  | { kind: "unavailable" }
  | { kind: "ready"; apiKey: string };

/**
 * Distinguishes a genuinely new account from a key that exists but cannot be
 * recovered. Never replace an existing key automatically: its hash may still
 * be authenticating a merchant's live integration.
 */
export function resolveStoredDirectApiKey(
  storedKey: string | null | undefined,
  storedHash: string | null | undefined,
): DirectApiKeyResolution {
  if (!storedKey) {
    return storedHash ? { kind: "unavailable" } : { kind: "missing" };
  }

  const apiKey = decryptField(storedKey);
  if (!apiKey || (storedKey.startsWith("enc:") && apiKey === storedKey)) {
    return { kind: "unavailable" };
  }

  return { kind: "ready", apiKey };
}
