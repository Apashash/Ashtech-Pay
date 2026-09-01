import assert from "node:assert/strict";
import test from "node:test";
import {
  PAWAPAY_PRODUCTION_BASE_URL,
  PAWAPAY_CUSTOMER_MESSAGE,
  clearPawaPayActiveConfigurationCache,
  createPawaPayDeposit,
  createPawaPayPayout,
  createPawaPayPaymentPage,
  assertPawaPayProviderActive,
  classifyPawaPayControlledTransaction,
  getPawaPayDeposit,
  getPawaPayActiveConfiguration,
  resolvePawaPayOperationConfiguration,
  isPawaPayConfigured,
  normalizePawaPayStatus,
  validatePawaPayAmount,
  formatPawaPayAmount,
  formatPawaPayMsisdn,
  validatePawaPayCurrency,
  validatePawaPayMsisdn,
} from "../server/pawapay.ts";
import {
  PAWAPAY_DEPOSIT_CALLBACK_URL,
  PAWAPAY_PAYOUT_CALLBACK_URL,
  PAWAPAY_PRODUCTION_BASE_URL as CONFIGURED_PRODUCTION_URL,
  maskPawaPaySecret,
  replacePawaPayCredentials,
} from "../server/pawapayConfig.ts";
import { encryptField } from "../server/fieldEncryption.ts";
import {
  encryptPawaPayCredential,
  isPawaPayCredentialEncryptionConfigured,
  readPawaPayStoredSecret,
} from "../server/pawapayCredentialEncryption.ts";
import { storage } from "../server/storage.ts";

const originalFetch = globalThis.fetch;
const originalToken = process.env.PAWAPAY_API_TOKEN;
const originalFieldEncryptionKey = process.env.FIELD_ENCRYPTION_KEY;
const originalSupabaseDatabaseUrl = process.env.SUPABASE_DATABASE_URL;
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalSessionSecret = process.env.SESSION_SECRET;
const originalPawaPayEncryptionKey = process.env.PAWAPAY_CREDENTIAL_ENCRYPTION_KEY;
const originalGetSetting = storage.getSetting;
const requestId = "5c0cbb4b-8961-45d5-8948-aa7ad7f42c65";

function restoreEnvironment() {
  if (originalToken === undefined) delete process.env.PAWAPAY_API_TOKEN; else process.env.PAWAPAY_API_TOKEN = originalToken;
  if (originalFieldEncryptionKey === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
  else process.env.FIELD_ENCRYPTION_KEY = originalFieldEncryptionKey;
  if (originalSupabaseDatabaseUrl === undefined) delete process.env.SUPABASE_DATABASE_URL;
  else process.env.SUPABASE_DATABASE_URL = originalSupabaseDatabaseUrl;
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = originalSessionSecret;
  if (originalPawaPayEncryptionKey === undefined) delete process.env.PAWAPAY_CREDENTIAL_ENCRYPTION_KEY;
  else process.env.PAWAPAY_CREDENTIAL_ENCRYPTION_KEY = originalPawaPayEncryptionKey;
  storage.getSetting = originalGetSetting;
}

test("PawaPay validates MSISDN, currency, and documented decimal amount format", () => {
  assert.equal(validatePawaPayMsisdn("237656000000"), "237656000000");
  assert.throws(() => validatePawaPayMsisdn("+237656000000"));
  assert.throws(() => validatePawaPayMsisdn("0237656000000"));
  assert.equal(formatPawaPayMsisdn("683677872", "CMR"), "237683677872");
  assert.equal(formatPawaPayMsisdn("06 83 67 78 72", "CM"), "237683677872");
  assert.equal(formatPawaPayMsisdn("237683677872", "CMR"), "237683677872");
  assert.equal(validatePawaPayCurrency("XAF"), "XAF");
  assert.throws(() => validatePawaPayCurrency("xaf"));
  assert.equal(validatePawaPayAmount("100.5"), "100.5");
  assert.equal(validatePawaPayAmount("1.0001"), "1.0001");
  assert.throws(() => validatePawaPayAmount("1.0000"));
  assert.throws(() => validatePawaPayAmount("1.00001"));
  assert.throws(() => validatePawaPayAmount("1e2"));
  assert.equal(formatPawaPayAmount("200.00"), "200");
  assert.equal(formatPawaPayAmount(200), "200");
  assert.equal(formatPawaPayAmount("100.50"), "100.5");
});

test("PawaPay normalizes provider transaction states", () => {
  assert.equal(normalizePawaPayStatus("COMPLETED"), "completed");
  assert.equal(normalizePawaPayStatus("REJECTED"), "failed");
  assert.equal(normalizePawaPayStatus("ACCEPTED"), "pending");
});

test("PawaPay production settings mask secrets and never place them in callback URLs", () => {
  const token = "prod-token-123456";
  assert.equal(maskPawaPaySecret(token), "••••3456");
  assert.equal(maskPawaPaySecret(""), null);
  assert.equal(CONFIGURED_PRODUCTION_URL, "https://api.pawapay.io/v2");
  assert.equal(PAWAPAY_DEPOSIT_CALLBACK_URL, "https://ashtechpay.top/api/pawapay/deposit-callback");
  assert.equal(PAWAPAY_PAYOUT_CALLBACK_URL, "https://ashtechpay.top/api/pawapay/payout-callback");
  assert.equal(PAWAPAY_DEPOSIT_CALLBACK_URL.includes(token), false);
  assert.equal(PAWAPAY_PAYOUT_CALLBACK_URL.includes(token), false);
});

test("PawaPay credential encryption uses the existing server session secret", () => {
  delete process.env.PAWAPAY_CREDENTIAL_ENCRYPTION_KEY;
  delete process.env.SUPABASE_DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.env.SESSION_SECRET = "stable-session-secret-for-tests";
  delete process.env.FIELD_ENCRYPTION_KEY;
  const ciphertext = encryptPawaPayCredential("prod-token-123456");
  assert.ok(ciphertext?.startsWith("enc:pawapay:v1:"));
  assert.equal(ciphertext?.includes("prod-token-123456"), false);
  assert.deepEqual(readPawaPayStoredSecret(ciphertext), {
    value: "prod-token-123456",
    legacy: false,
  });
  assert.equal(isPawaPayCredentialEncryptionConfigured(), true);
  restoreEnvironment();
});

test("PawaPay credential encryption uses the field key when no database key exists", () => {
  delete process.env.PAWAPAY_CREDENTIAL_ENCRYPTION_KEY;
  delete process.env.SUPABASE_DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.env.FIELD_ENCRYPTION_KEY = "stable-field-key-for-tests";
  process.env.SESSION_SECRET = "worker-specific-session-key";
  const ciphertext = encryptPawaPayCredential("prod-token-123456");
  process.env.SESSION_SECRET = "another-worker-session-key";
  assert.deepEqual(readPawaPayStoredSecret(ciphertext), {
    value: "prod-token-123456",
    legacy: false,
  });
  restoreEnvironment();
});

test("PawaPay credential encryption prefers the stable database key over a changing field key", () => {
  delete process.env.PAWAPAY_CREDENTIAL_ENCRYPTION_KEY;
  process.env.SUPABASE_DATABASE_URL = "stable-database-connection-secret-for-tests";
  process.env.FIELD_ENCRYPTION_KEY = "first-worker-field-key";
  process.env.SESSION_SECRET = "first-worker-session-key";
  const ciphertext = encryptPawaPayCredential("prod-token-123456");
  process.env.FIELD_ENCRYPTION_KEY = "second-worker-field-key";
  process.env.SESSION_SECRET = "second-worker-session-key";
  assert.deepEqual(readPawaPayStoredSecret(ciphertext), {
    value: "prod-token-123456",
    legacy: false,
  });
  restoreEnvironment();
});

test("PawaPay credential encryption works from the stable database connection secret", () => {
  delete process.env.PAWAPAY_CREDENTIAL_ENCRYPTION_KEY;
  delete process.env.FIELD_ENCRYPTION_KEY;
  delete process.env.SESSION_SECRET;
  delete process.env.DATABASE_URL;
  process.env.SUPABASE_DATABASE_URL = "stable-database-connection-secret-for-tests";
  const ciphertext = encryptPawaPayCredential("prod-token-123456");
  process.env.SUPABASE_DATABASE_URL = "another-worker-database-secret-should-not-be-used";
  process.env.SESSION_SECRET = "worker-session-secret";
  assert.deepEqual(readPawaPayStoredSecret(ciphertext), {
    value: null,
    legacy: false,
  });
  process.env.SUPABASE_DATABASE_URL = "stable-database-connection-secret-for-tests";
  assert.deepEqual(readPawaPayStoredSecret(ciphertext), {
    value: "prod-token-123456",
    legacy: false,
  });
  restoreEnvironment();
});

test("PawaPay credential reads legacy FIELD_ENCRYPTION_KEY values", () => {
  delete process.env.PAWAPAY_CREDENTIAL_ENCRYPTION_KEY;
  delete process.env.SESSION_SECRET;
  process.env.FIELD_ENCRYPTION_KEY = "legacy-field-key-for-tests";
  const legacyCiphertext = encryptField("legacy-token-123456");
  assert.ok(legacyCiphertext?.startsWith("enc:"));
  assert.deepEqual(readPawaPayStoredSecret(legacyCiphertext), {
    value: "legacy-token-123456",
    legacy: true,
  });
  restoreEnvironment();
});

test("PawaPay credential writes fail closed without a server encryption secret", async () => {
  delete process.env.PAWAPAY_CREDENTIAL_ENCRYPTION_KEY;
  delete process.env.FIELD_ENCRYPTION_KEY;
  delete process.env.SUPABASE_DATABASE_URL;
  delete process.env.DATABASE_URL;
  delete process.env.SESSION_SECRET;
  await assert.rejects(
    () => replacePawaPayCredentials({ apiToken: "prod-token-123456" }),
    /server encryption secret/,
  );
  restoreEnvironment();
});

test("PawaPay is safely unconfigured until a token is supplied", async () => {
  delete process.env.PAWAPAY_API_TOKEN;
  storage.getSetting = async () => undefined;
  try {
    assert.equal(await isPawaPayConfigured(), false);
  } finally {
    restoreEnvironment();
  }
});

test("PawaPay uses production bearer auth and sends a v2 MMO deposit", async () => {
  process.env.PAWAPAY_API_TOKEN = "test-token";
  storage.getSetting = async () => undefined;
  let receivedUrl = "";
  let receivedInit: RequestInit | undefined;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).endsWith("/active-conf")) {
      return new Response(JSON.stringify({ providers: [{ provider: "MTN_MOMO_CMR", operationTypes: ["DEPOSIT"] }] }), { status: 200 });
    }
    receivedUrl = String(url);
    receivedInit = init;
    return new Response(JSON.stringify({ depositId: requestId, status: "ACCEPTED" }), { status: 200 });
  }) as typeof fetch;

  try {
    clearPawaPayActiveConfigurationCache();
    const result = await createPawaPayDeposit({
      depositId: requestId, amount: "100", currency: "XAF",
      country: "CMR",
       payer: { provider: "MTN_MOMO_CMR", phoneNumber: "656000000" },
      metadata: { order: "abc" },
    });
    assert.equal(receivedUrl, `${PAWAPAY_PRODUCTION_BASE_URL}/deposits`);
    assert.equal((receivedInit?.headers as Record<string, string>).Authorization, "Bearer test-token");
    const body = JSON.parse(String(receivedInit?.body));
    assert.deepEqual(body.payer, {
      type: "MMO",
       accountDetails: { provider: "MTN_MOMO_CMR", phoneNumber: "237656000000" },
    });
    assert.deepEqual(body.metadata, [{ order: "abc" }]);
    assert.equal(body.customerMessage, PAWAPAY_CUSTOMER_MESSAGE);
    assert.equal("statementDescription" in body, false);
    assert.equal("callbackUrl" in body, false);
    assert.equal(result.status, "pending");
    assert.equal(result.success, true);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test("PawaPay reads nested deposit data and creates payment pages with v2 fields", async () => {
  process.env.PAWAPAY_API_TOKEN = "test-token";
  const requests: Array<{ url: string; body?: any }> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (String(url).endsWith("/active-conf")) {
      return new Response(JSON.stringify({ providers: [{ provider: "MTN_MOMO_CMR", operationTypes: ["DEPOSIT"] }] }), { status: 200 });
    }
    if (String(url).endsWith(`/deposits/${requestId}`)) {
      return new Response(JSON.stringify({ status: "FOUND", data: { depositId: requestId, status: "COMPLETED" } }), { status: 200 });
    }
    return new Response(JSON.stringify({ depositId: requestId, status: "ACCEPTED", redirectUrl: "https://pay.example/redirect" }), { status: 200 });
  }) as typeof fetch;
  try {
    clearPawaPayActiveConfigurationCache();
    const found = await getPawaPayDeposit(requestId);
    assert.equal(found.id, requestId);
    assert.equal(found.status, "completed");
     const page = await createPawaPayPaymentPage({
       depositId: requestId, amount: "200.00", currency: "USD",
      returnUrl: "https://merchant.example/return", phoneNumber: "237656000000",
      provider: "MTN_MOMO_CMR",
    });
    assert.equal(page.redirectUrl, "https://pay.example/redirect");
    const pageRequest = requests.find(request => request.url.endsWith("/paymentpage"))!;
     assert.deepEqual(pageRequest.body.amountDetails, { amount: "200", currency: "USD" });
    assert.equal(pageRequest.body.depositId, requestId);
    assert.equal(pageRequest.body.phoneNumber, "237656000000");
     assert.equal(pageRequest.body.customerMessage, PAWAPAY_CUSTOMER_MESSAGE);
    assert.equal("provider" in pageRequest.body, false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test("PawaPay exposes failure reasons from rejected deposit responses", async () => {
  process.env.PAWAPAY_API_TOKEN = "test-token";
  clearPawaPayActiveConfigurationCache();
  globalThis.fetch = (async (url: string | URL | Request) => {
    if (String(url).endsWith("/active-conf")) {
      return new Response(JSON.stringify({ providers: [{ provider: "MTN_MOMO_CMR", operationTypes: ["DEPOSIT"] }] }), { status: 200 });
    }
    return new Response(JSON.stringify({
      status: "REJECTED",
      failureReason: "The payer account is not active.",
      errorCode: "OPERATOR_PAYER_NOT_FOUND",
    }), { status: 422 });
  }) as typeof fetch;

  try {
    const result = await createPawaPayDeposit({
      depositId: requestId,
      amount: "100",
      currency: "XAF",
      country: "CMR",
      payer: { provider: "MTN_MOMO_CMR", phoneNumber: "237656000000" },
    });
    assert.equal(result.success, false);
    assert.equal(result.status, "failed");
    assert.equal(result.providerMessage, "The payer account is not active.");
    assert.equal(result.providerCode, "OPERATOR_PAYER_NOT_FOUND");
    assert.equal(result.providerStatus, 422);
  } finally {
    clearPawaPayActiveConfigurationCache();
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test("PawaPay exposes failure reasons from rejected payout responses", async () => {
  process.env.PAWAPAY_API_TOKEN = "test-token";
  clearPawaPayActiveConfigurationCache();
  globalThis.fetch = (async (url: string | URL | Request) => {
    if (String(url).endsWith("/active-conf")) {
      return new Response(JSON.stringify({
        countries: [{
          country: "CMR",
          providers: [{
            provider: "MTN_MOMO_CMR",
            currencies: [{ currency: "XAF", operationTypes: { PAYOUT: { status: "OPERATIONAL" } } }],
          }],
        }],
      }), { status: 200 });
    }
    return new Response(JSON.stringify({
      payoutId: requestId,
      status: "REJECTED",
      failureReason: {
        failureCode: "RECIPIENT_NOT_FOUND",
        failureMessage: "The recipient account does not exist.",
      },
    }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await createPawaPayPayout({
      payoutId: requestId,
      amount: "100",
      currency: "XAF",
      country: "CMR",
      recipient: { provider: "MTN_MOMO_CMR", phoneNumber: "237656000000" },
    });
    assert.equal(result.success, false);
    assert.equal(result.status, "failed");
    assert.equal(result.providerMessage, "The recipient account does not exist.");
    assert.equal(result.providerCode, "RECIPIENT_NOT_FOUND");
    assert.equal(result.providerStatus, undefined);
  } finally {
    clearPawaPayActiveConfigurationCache();
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test("PawaPay extracts documented nested failureReason from HTTP 200 rejections", async () => {
  process.env.PAWAPAY_API_TOKEN = "test-token";
  clearPawaPayActiveConfigurationCache();
  globalThis.fetch = (async (url: string | URL | Request) => {
    if (String(url).endsWith("/active-conf")) {
      return new Response(JSON.stringify({ providers: [{ provider: "MTN_MOMO_CMR", operationTypes: ["DEPOSIT"] }] }), { status: 200 });
    }
    return new Response(JSON.stringify({
      depositId: requestId,
      status: "REJECTED",
      failureReason: {
        failureCode: "OPERATOR_PAYER_NOT_FOUND",
        failureMessage: "The payer account is not active.",
      },
    }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await createPawaPayDeposit({
      depositId: requestId,
      amount: "200",
      currency: "XAF",
      country: "CMR",
      payer: { provider: "MTN_MOMO_CMR", phoneNumber: "237683677872" },
    });
    assert.equal(result.success, false);
    assert.equal(result.status, "failed");
    assert.equal(result.providerMessage, "The payer account is not active.");
    assert.equal(result.providerCode, "OPERATOR_PAYER_NOT_FOUND");
    assert.equal(result.providerStatus, undefined);
  } finally {
    clearPawaPayActiveConfigurationCache();
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test("PawaPay caches active-conf responses", async () => {
  process.env.PAWAPAY_API_TOKEN = "test-token";
  clearPawaPayActiveConfigurationCache();
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response(JSON.stringify({ providers: [{ provider: "MTN_MOMO_CMR" }] }), { status: 200 });
  }) as typeof fetch;
  try {
    await getPawaPayActiveConfiguration();
    await getPawaPayActiveConfiguration();
    assert.equal(calls, 1);
  } finally {
    clearPawaPayActiveConfigurationCache();
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test("PawaPay rejects mutation when provider is inactive", async () => {
  process.env.PAWAPAY_API_TOKEN = "test-token";
  clearPawaPayActiveConfigurationCache();
  let mutationCalled = false;
  globalThis.fetch = (async (url: string | URL | Request) => {
    if (String(url).endsWith("/active-conf")) {
      return new Response(JSON.stringify({ providers: [] }), { status: 200 });
    }
    mutationCalled = true;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  try {
    await assert.rejects(() => createPawaPayDeposit({
      depositId: requestId, amount: "100", currency: "XAF",
      country: "CMR",
      payer: { provider: "MTN_MOMO_CMR", phoneNumber: "237656000000" },
    }), /not active/);
    assert.equal(mutationCalled, false);
  } finally {
    clearPawaPayActiveConfigurationCache();
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test("PawaPay active configuration enforces country and operation", async () => {
  process.env.PAWAPAY_API_TOKEN = "test-token";
  clearPawaPayActiveConfigurationCache();
  globalThis.fetch = (async () => new Response(JSON.stringify({
    countries: [{
      country: "GHA",
      providers: [{ provider: "MTN_MOMO_GHA", operationTypes: ["DEPOSIT"] }],
    }],
  }), { status: 200 })) as typeof fetch;
  try {
    await assert.rejects(
      () => assertPawaPayProviderActive("MTN_MOMO_GHA", "DEPOSIT", "CMR"),
      /not active/,
    );
    await assertPawaPayProviderActive("MTN_MOMO_GHA", "DEPOSIT", "GHA");
  } finally {
    clearPawaPayActiveConfigurationCache();
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test("PawaPay active configuration accepts snake_case provider and country fields", async () => {
  process.env.PAWAPAY_API_TOKEN = "test-token";
  clearPawaPayActiveConfigurationCache();
  globalThis.fetch = (async () => new Response(JSON.stringify({
    countries: [{
      country_code: "CM",
      providers: [{ provider_code: "MTN_MOMO_CMR", operation_types: ["DEPOSIT"] }],
    }],
  }), { status: 200 })) as typeof fetch;
  try {
    await assertPawaPayProviderActive("MTN_MOMO_CMR", "DEPOSIT", "CMR");
  } finally {
    clearPawaPayActiveConfigurationCache();
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test("PawaPay active configuration reads operation types nested under currencies", async () => {
  process.env.PAWAPAY_API_TOKEN = "test-token";
  clearPawaPayActiveConfigurationCache();
  globalThis.fetch = (async () => new Response(JSON.stringify({
    countries: [{
      country: "CMR",
      providers: [{
        provider: "MTN_MOMO_CMR",
        currencies: [{
          currency: "XAF",
          operationTypes: { DEPOSIT: { authType: "PROVIDER_AUTH" } },
        }],
      }],
    }],
  }), { status: 200 })) as typeof fetch;
  try {
    await assertPawaPayProviderActive("MTN_MOMO_CMR", "DEPOSIT", "CMR");
  } finally {
    clearPawaPayActiveConfigurationCache();
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test("PawaPay resolves nested authorization details by country, provider, and currency", async () => {
  process.env.PAWAPAY_API_TOKEN = "test-token";
  clearPawaPayActiveConfigurationCache();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).endsWith("/active-conf")) {
      return new Response(JSON.stringify({
        countries: [{
          country: "CIV",
          providers: [{
            provider: "WAVE_CIV",
            currencies: [{
              currency: "XOF",
              operationTypes: {
                DEPOSIT: {
                  authType: "REDIRECT_AUTH",
                  status: "OPERATIONAL",
                  pinPromptInstructions: { channels: [{ type: "APP", instructions: { fr: [{ text: "Ouvrez Wave" }] } }] },
                },
              },
            }],
          }],
        }],
      }), { status: 200 });
    }
    assert.equal(String(url).endsWith("/deposits"), true);
    const body = JSON.parse(String(init?.body));
    assert.equal("successfulUrl" in body, false);
    assert.equal("failedUrl" in body, false);
    assert.equal(body.preAuthorisationCode, "367025");
    return new Response(JSON.stringify({
      depositId: requestId,
      status: "PROCESSING",
      nextStep: "REDIRECT_TO_AUTH_URL",
      authorizationUrl: "https://wave.example/authorize",
    }), { status: 200 });
  }) as typeof fetch;
  try {
    const operation = await resolvePawaPayOperationConfiguration("WAVE_CIV", "DEPOSIT", "CI", "XOF");
    assert.equal(operation?.authType, "REDIRECT_AUTH");
    assert.equal(operation?.pinPromptInstructions?.channels?.[0]?.instructions?.fr?.[0]?.text, "Ouvrez Wave");

    const result = await createPawaPayDeposit({
      depositId: requestId,
      amount: "100",
      currency: "XOF",
      country: "CIV",
      payer: { provider: "WAVE_CIV", phoneNumber: "2250700000000" },
      preAuthorisationCode: "367025",
    });
    assert.equal(result.authType, "REDIRECT_AUTH");
    assert.equal(result.authorizationUrl, "https://wave.example/authorize");
    assert.equal(result.nextStep, "REDIRECT_TO_AUTH_URL");
  } finally {
    clearPawaPayActiveConfigurationCache();
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test("PawaPay does not accept a currency that is absent from active-conf", async () => {
  process.env.PAWAPAY_API_TOKEN = "test-token";
  clearPawaPayActiveConfigurationCache();
  globalThis.fetch = (async () => new Response(JSON.stringify({
    countries: [{
      country: "CIV",
      providers: [{
        provider: "WAVE_CIV",
        currencies: [{ currency: "XOF", operationTypes: { DEPOSIT: { status: "OPERATIONAL" } } }],
      }],
    }],
  }), { status: 200 })) as typeof fetch;
  try {
    await assert.rejects(
      () => assertPawaPayProviderActive("WAVE_CIV", "DEPOSIT", "CIV", "XAF"),
      /not active/,
    );
  } finally {
    clearPawaPayActiveConfigurationCache();
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test("UUID-bearing PawaPay incoming transactions are provider controlled", () => {
  assert.equal(classifyPawaPayControlledTransaction("deposit", requestId), "incoming");
  assert.equal(classifyPawaPayControlledTransaction("payment_link", requestId), "incoming");
  assert.equal(classifyPawaPayControlledTransaction("deposit", "legacy-reference"), null);
});