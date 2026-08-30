import assert from "node:assert/strict";
import test from "node:test";
import {
  PAWAPAY_PRODUCTION_BASE_URL,
  clearPawaPayActiveConfigurationCache,
  createPawaPayDeposit,
  createPawaPayPaymentPage,
  assertPawaPayProviderActive,
  classifyPawaPayControlledTransaction,
  getPawaPayDeposit,
  getPawaPayActiveConfiguration,
  isPawaPayConfigured,
  normalizePawaPayStatus,
  validatePawaPayAmount,
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

const originalFetch = globalThis.fetch;
const originalToken = process.env.PAWAPAY_API_TOKEN;
const requestId = "5c0cbb4b-8961-45d5-8948-aa7ad7f42c65";

function restoreEnvironment() {
  if (originalToken === undefined) delete process.env.PAWAPAY_API_TOKEN; else process.env.PAWAPAY_API_TOKEN = originalToken;
}

test("PawaPay validates MSISDN, currency, and documented decimal amount format", () => {
  assert.equal(validatePawaPayMsisdn("237656000000"), "237656000000");
  assert.throws(() => validatePawaPayMsisdn("+237656000000"));
  assert.throws(() => validatePawaPayMsisdn("0237656000000"));
  assert.equal(validatePawaPayCurrency("XAF"), "XAF");
  assert.throws(() => validatePawaPayCurrency("xaf"));
  assert.equal(validatePawaPayAmount("100.5"), "100.5");
  assert.equal(validatePawaPayAmount("1.0001"), "1.0001");
  assert.throws(() => validatePawaPayAmount("1.0000"));
  assert.throws(() => validatePawaPayAmount("1.00001"));
  assert.throws(() => validatePawaPayAmount("1e2"));
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

test("PawaPay credential writes fail closed without the field encryption key", async () => {
  const originalKey = process.env.FIELD_ENCRYPTION_KEY;
  delete process.env.FIELD_ENCRYPTION_KEY;
  await assert.rejects(
    () => replacePawaPayCredentials({ apiToken: "prod-token-123456" }),
    /FIELD_ENCRYPTION_KEY/,
  );
  if (originalKey === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
  else process.env.FIELD_ENCRYPTION_KEY = originalKey;
});

test("PawaPay is safely unconfigured until a token is supplied", async () => {
  delete process.env.PAWAPAY_API_TOKEN;
  assert.equal(await isPawaPayConfigured(), false);
  restoreEnvironment();
});

test("PawaPay uses production bearer auth and sends a v2 MMO deposit", async () => {
  process.env.PAWAPAY_API_TOKEN = "test-token";
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
      payer: { provider: "MTN_MOMO_CMR", phoneNumber: "237656000000" },
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
      depositId: requestId, amount: "1.0001", currency: "USD",
      returnUrl: "https://merchant.example/return", phoneNumber: "237656000000",
      provider: "MTN_MOMO_CMR",
    });
    assert.equal(page.redirectUrl, "https://pay.example/redirect");
    const pageRequest = requests.find(request => request.url.endsWith("/paymentpage"))!;
    assert.deepEqual(pageRequest.body.amountDetails, { amount: "1.0001", currency: "USD" });
    assert.equal(pageRequest.body.depositId, requestId);
    assert.equal(pageRequest.body.phoneNumber, "237656000000");
    assert.equal("provider" in pageRequest.body, false);
  } finally {
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

test("UUID-bearing PawaPay incoming transactions are provider controlled", () => {
  assert.equal(classifyPawaPayControlledTransaction("deposit", requestId), "incoming");
  assert.equal(classifyPawaPayControlledTransaction("payment_link", requestId), "incoming");
  assert.equal(classifyPawaPayControlledTransaction("deposit", "legacy-reference"), null);
});