import { storage } from "./storage";
import { decryptField, encryptField, isFieldEncryptionConfigured } from "./fieldEncryption";

export const PAWAPAY_API_TOKEN_KEY = "pawapay_api_token";
export const PAWAPAY_WEBHOOK_SECRET_KEY = "pawapay_webhook_secret";
export const PAWAPAY_PRODUCTION_BASE_URL = "https://api.pawapay.io/v2";
export const PAWAPAY_PUBLIC_BASE_URL = "https://ashtechpay.top";
export const PAWAPAY_DEPOSIT_CALLBACK_URL = `${PAWAPAY_PUBLIC_BASE_URL}/api/pawapay/deposit-callback`;
export const PAWAPAY_PAYOUT_CALLBACK_URL = `${PAWAPAY_PUBLIC_BASE_URL}/api/pawapay/payout-callback`;

const CACHE_TTL_MS = 30_000;

type PawaPayCredentials = {
  apiToken: string | null;
  webhookSecret: string | null;
};

let cachedCredentials: { value: PawaPayCredentials; expiresAt: number } | null = null;

function decryptStoredSecret(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("enc:")) return null;
  const decrypted = decryptField(value);
  return decrypted?.trim() || null;
}

export function maskPawaPaySecret(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return `••••${trimmed.slice(-4)}`;
}

export async function getPawaPayCredentials(forceRefresh = false): Promise<PawaPayCredentials> {
  if (!forceRefresh && cachedCredentials && cachedCredentials.expiresAt > Date.now()) {
    return cachedCredentials.value;
  }

  const [tokenSetting, webhookSetting] = await Promise.all([
    storage.getSetting(PAWAPAY_API_TOKEN_KEY),
    storage.getSetting(PAWAPAY_WEBHOOK_SECRET_KEY),
  ]);
  const value = {
    apiToken: decryptStoredSecret(tokenSetting?.value),
    webhookSecret: decryptStoredSecret(webhookSetting?.value),
  };
  cachedCredentials = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export async function getPawaPayApiToken(): Promise<string | null> {
  return (await getPawaPayCredentials()).apiToken;
}

export async function getPawaPayWebhookSecret(): Promise<string | null> {
  return (await getPawaPayCredentials()).webhookSecret;
}

export function clearPawaPayCredentialsCache(): void {
  cachedCredentials = null;
}

function validateSecret(name: string, value: string, minimumLength: number): string {
  const normalized = value.trim();
  if (normalized.length < minimumLength || normalized.length > 4096) {
    throw new Error(`${name} has an invalid length`);
  }
  return normalized;
}

export async function replacePawaPayCredentials(input: {
  apiToken?: string;
  webhookSecret?: string;
}): Promise<void> {
  if (!isFieldEncryptionConfigured()) {
    throw new Error("FIELD_ENCRYPTION_KEY is required before PawaPay credentials can be saved");
  }

  const apiToken = typeof input.apiToken === "string" ? input.apiToken.trim() : "";
  const webhookSecret = typeof input.webhookSecret === "string" ? input.webhookSecret.trim() : "";
  if (!apiToken && !webhookSecret) {
    throw new Error("At least one PawaPay credential is required");
  }

  if (apiToken) {
    await storage.upsertSetting(
      PAWAPAY_API_TOKEN_KEY,
      encryptField(validateSecret("PawaPay API token", apiToken, 8))!,
      "PawaPay production Bearer token (encrypted)",
    );
  }
  if (webhookSecret) {
    await storage.upsertSetting(
      PAWAPAY_WEBHOOK_SECRET_KEY,
      encryptField(validateSecret("PawaPay webhook secret", webhookSecret, 16))!,
      "PawaPay production callback secret (encrypted)",
    );
  }
  clearPawaPayCredentialsCache();
}

export async function getPawaPaySettingsView() {
  const credentials = await getPawaPayCredentials();
  return {
    apiTokenConfigured: Boolean(credentials.apiToken),
    apiTokenMasked: maskPawaPaySecret(credentials.apiToken),
    webhookSecretConfigured: Boolean(credentials.webhookSecret),
    webhookSecretMasked: maskPawaPaySecret(credentials.webhookSecret),
    baseUrl: PAWAPAY_PRODUCTION_BASE_URL,
    callbackUrls: {
      deposit: PAWAPAY_DEPOSIT_CALLBACK_URL,
      payout: PAWAPAY_PAYOUT_CALLBACK_URL,
    },
  };
}