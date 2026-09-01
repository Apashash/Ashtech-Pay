import { storage } from "./storage";
import {
  encryptPawaPayCredential,
  isPawaPayCredentialEncryptionConfigured,
  readPawaPayStoredSecret,
} from "./pawapayCredentialEncryption";

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

function readEnvironmentSecret(name: string, minimumLength: number): string | null {
  const value = process.env[name]?.trim();
  if (!value || value.length < minimumLength || value.length > 4096) return null;
  return value;
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
  const storedApiTokenResult = readPawaPayStoredSecret(tokenSetting?.value);
  const storedWebhookSecretResult = readPawaPayStoredSecret(webhookSetting?.value);
  const storedApiToken = storedApiTokenResult.value?.trim() || null;
  const storedWebhookSecret = storedWebhookSecretResult.value?.trim() || null;
  const environmentApiToken = readEnvironmentSecret("PAWAPAY_API_TOKEN", 8);
  const environmentWebhookSecret = readEnvironmentSecret("PAWAPAY_WEBHOOK_SECRET", 16);
  const value = {
    apiToken: storedApiToken || environmentApiToken,
    webhookSecret: storedWebhookSecret || environmentWebhookSecret,
  };

  // A secure environment secret can repair a row encrypted with an old key.
  // The environment value is never returned by the API; once rewritten, the
  // normal encrypted platform setting remains the source of truth.
  if (isPawaPayCredentialEncryptionConfigured()) {
    const repairs: Promise<unknown>[] = [];
    if (environmentApiToken && !storedApiToken) {
      repairs.push(storage.upsertSetting(
        PAWAPAY_API_TOKEN_KEY,
        encryptPawaPayCredential(environmentApiToken)!,
        "PawaPay production Bearer token (encrypted)",
      ));
    }
    if (environmentWebhookSecret && !storedWebhookSecret) {
      repairs.push(storage.upsertSetting(
        PAWAPAY_WEBHOOK_SECRET_KEY,
        encryptPawaPayCredential(environmentWebhookSecret)!,
        "PawaPay production callback secret (encrypted)",
      ));
    }
    if (storedApiToken && storedApiTokenResult.legacy) {
      repairs.push(storage.upsertSetting(
        PAWAPAY_API_TOKEN_KEY,
        encryptPawaPayCredential(storedApiToken)!,
        "PawaPay production Bearer token (encrypted)",
      ));
    }
    if (storedWebhookSecret && storedWebhookSecretResult.legacy) {
      repairs.push(storage.upsertSetting(
        PAWAPAY_WEBHOOK_SECRET_KEY,
        encryptPawaPayCredential(storedWebhookSecret)!,
        "PawaPay production callback secret (encrypted)",
      ));
    }
    if (repairs.length > 0) await Promise.all(repairs);
  }

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
  if (!isPawaPayCredentialEncryptionConfigured()) {
    throw new Error("PawaPay credential encryption requires a server encryption secret");
  }

  const apiToken = typeof input.apiToken === "string" ? input.apiToken.trim() : "";
  const webhookSecret = typeof input.webhookSecret === "string" ? input.webhookSecret.trim() : "";
  if (!apiToken && !webhookSecret) {
    throw new Error("At least one PawaPay credential is required");
  }

  if (apiToken) {
    await storage.upsertSetting(
      PAWAPAY_API_TOKEN_KEY,
      encryptPawaPayCredential(validateSecret("PawaPay API token", apiToken, 8))!,
      "PawaPay production Bearer token (encrypted)",
    );
  }
  if (webhookSecret) {
    await storage.upsertSetting(
      PAWAPAY_WEBHOOK_SECRET_KEY,
      encryptPawaPayCredential(validateSecret("PawaPay webhook secret", webhookSecret, 16))!,
      "PawaPay production callback secret (encrypted)",
    );
  }
  clearPawaPayCredentialsCache();

  // Read back what was written in this process. This catches an invalid
  // encryption setup immediately instead of leaving the admin with a false
  // sense that the credential is usable.
  const saved = await getPawaPayCredentials(true);
  if (apiToken && saved.apiToken !== apiToken) {
      throw new Error("PawaPay API token was saved but cannot be read back; verify the server encryption configuration");
  }
  if (webhookSecret && saved.webhookSecret !== webhookSecret) {
      throw new Error("PawaPay webhook secret was saved but cannot be read back; verify the server encryption configuration");
  }
}

export async function getPawaPaySettingsView() {
  const [credentials, tokenSetting, webhookSetting] = await Promise.all([
    getPawaPayCredentials(true),
    storage.getSetting(PAWAPAY_API_TOKEN_KEY),
    storage.getSetting(PAWAPAY_WEBHOOK_SECRET_KEY),
  ]);
  const tokenStored = Boolean(tokenSetting?.value?.trim());
  const webhookStored = Boolean(webhookSetting?.value?.trim());
  return {
    apiTokenConfigured: Boolean(credentials.apiToken),
    apiTokenMasked: maskPawaPaySecret(credentials.apiToken),
    apiTokenUnreadable: tokenStored && !credentials.apiToken,
    webhookSecretConfigured: Boolean(credentials.webhookSecret),
    webhookSecretMasked: maskPawaPaySecret(credentials.webhookSecret),
    webhookSecretUnreadable: webhookStored && !credentials.webhookSecret,
    credentialEncryptionConfigured: isPawaPayCredentialEncryptionConfigured(),
    baseUrl: PAWAPAY_PRODUCTION_BASE_URL,
    callbackUrls: {
      deposit: PAWAPAY_DEPOSIT_CALLBACK_URL,
      payout: PAWAPAY_PAYOUT_CALLBACK_URL,
    },
  };
}