import assert from "node:assert/strict";
import test from "node:test";
import {
  createAsyncTtlCache,
  isProviderStatusPollDue,
  providerStatusPollIntervalMs,
  recoveredStatusPollLastCheckedAt,
} from "../server/providerStatusPolicy.ts";
import {
  canRetryPayoutWithProvider,
  isExplicitInsufficientPayoutBalance,
  isPixPayManualPayoutProcessable,
  isPixPayPayoutProvider,
  normalizePayoutStatusProvider,
  resolvePayoutStatusProvider,
  resolvePayoutStatusLookupReference,
  shouldUseManualPayoutStatusOverride,
} from "../server/providerStatusReferences.ts";

test("provider retry is allowed only for an explicit insufficient-balance rejection", () => {
  for (const provider of ["afribapay", "pixpay", "pawapay"] as const) {
    assert.equal(isExplicitInsufficientPayoutBalance(provider, {
      success: false,
      providerStatus: 422,
      providerCode: "INSUFFICIENT_BALANCE",
    }), true);
    assert.equal(isExplicitInsufficientPayoutBalance(provider, {
      success: false,
      providerStatus: 200,
      status: "failed",
      message: "provider wallet balance too low",
      raw: { status: "FAILED" },
    }), true);
    assert.equal(isExplicitInsufficientPayoutBalance(provider, {
      success: false,
      providerStatus: 503,
      message: "insufficient provider balance",
      raw: { message: "insufficient provider balance" },
    }), false);
    assert.equal(isExplicitInsufficientPayoutBalance(provider, {
      success: false,
      providerStatus: 404,
      message: "insufficient provider balance",
      raw: { message: "insufficient provider balance" },
    }), false);
    assert.equal(isExplicitInsufficientPayoutBalance(provider, {
      success: false,
      providerStatus: 200,
      status: "NOT_FOUND",
      message: "insufficient provider balance",
      raw: { status: "NOT_FOUND" },
    }), false);
    assert.equal(isExplicitInsufficientPayoutBalance(provider, {
      success: false,
      providerStatus: 200,
      status: "ERROR",
      message: "insufficient provider balance",
      raw: { success: false, error: { code: "ERROR" } },
    }), false);
    assert.equal(isExplicitInsufficientPayoutBalance(provider, {
      success: false,
      message: "insufficient provider balance",
    }), false);
  }
  assert.equal(isExplicitInsufficientPayoutBalance("pixpay", {
    success: false,
    providerStatus: 1001,
    httpStatus: 200,
    message: "insufficient provider balance",
    raw: { statut_code: 1001, message: "insufficient provider balance" },
  }), true);
  assert.equal(isExplicitInsufficientPayoutBalance("pixpay", {
    success: false,
    providerStatus: 1001,
    httpStatus: 503,
    message: "insufficient provider balance",
    raw: { statut_code: 1001, message: "insufficient provider balance" },
  }), false);

  assert.equal(isExplicitInsufficientPayoutBalance("izichange", {
    success: false,
    providerStatus: 402,
    providerCode: "INSUFFICIENT_BALANCE",
  }), true);
  assert.equal(isExplicitInsufficientPayoutBalance("izichange", {
    success: false,
    providerStatus: 500,
    providerCode: "INSUFFICIENT_BALANCE",
  }), false);
});

test("safe payout retry is restricted to the provider that rejected for low balance", () => {
  const metadata = { payoutRetrySafe: true, payoutRetryProvider: "pawapay" };
  assert.equal(canRetryPayoutWithProvider(metadata, "pawapay"), true);
  assert.equal(canRetryPayoutWithProvider(metadata, "pixpay"), false);
  assert.equal(canRetryPayoutWithProvider({ ...metadata, payoutRetrySafe: false }, "pawapay"), false);
});

test("admin reconciliation recognizes only supported payout providers", () => {
  assert.equal(normalizePayoutStatusProvider(" AfribaPay "), "afribapay");
  assert.equal(normalizePayoutStatusProvider("PIXPay"), "pixpay");
  assert.equal(normalizePayoutStatusProvider("pawapay"), "pawapay");
  assert.equal(normalizePayoutStatusProvider("izichange"), "izichange");
  assert.equal(normalizePayoutStatusProvider("manual"), null);
  assert.equal(normalizePayoutStatusProvider(null), null);
});

test("the persisted retry provider takes precedence over a stale queued provider", () => {
  assert.equal(
    resolvePayoutStatusProvider("pixpay", "afribapay", "pawapay"),
    "pixpay",
  );
  assert.equal(
    resolvePayoutStatusProvider("unknown", null, "pixpay"),
    "pixpay",
  );
  assert.equal(resolvePayoutStatusProvider("unknown", null), null);
});

test("admin may override an unresolved payout, but ordinary pending approvals still submit normally", () => {
  assert.equal(shouldUseManualPayoutStatusOverride({
    transactionType: "withdrawal",
    currentStatus: "pending",
    requestedStatus: "completed",
    externalReference: "provider-attempt-123",
  }), true);
  assert.equal(shouldUseManualPayoutStatusOverride({
    transactionType: "transfer_out",
    currentStatus: "processing",
    requestedStatus: "failed",
  }), true);
  assert.equal(shouldUseManualPayoutStatusOverride({
    transactionType: "withdrawal",
    currentStatus: "pending",
    requestedStatus: "completed",
  }), false);
  assert.equal(shouldUseManualPayoutStatusOverride({
    transactionType: "withdrawal",
    currentStatus: "pending_manual",
    requestedStatus: "completed",
    forceManual: true,
  }), true);
  assert.equal(shouldUseManualPayoutStatusOverride({
    transactionType: "deposit",
    currentStatus: "pending",
    requestedStatus: "failed",
    externalReference: "provider-attempt-123",
  }), false);
  assert.equal(shouldUseManualPayoutStatusOverride({
    transactionType: "withdrawal",
    currentStatus: "pending",
    requestedStatus: "pending",
    externalReference: "provider-attempt-123",
  }), false);
});

test("PixPay manual payouts are processable only when the transaction records PixPay as provider", () => {
  assert.equal(isPixPayPayoutProvider({ paymentProvider: "pixpay" }), true);
  assert.equal(isPixPayPayoutProvider({ pendingPayoutProvider: "pixpay" }), true);
  assert.equal(isPixPayPayoutProvider({ paymentProvider: "afribapay" }), false);
  assert.equal(isPixPayManualPayoutProcessable("pixpay", "pending_manual", {
    paymentProvider: "pixpay",
  }), true);
  assert.equal(isPixPayManualPayoutProcessable("pixpay", "pending_manual", {
    pendingPayoutProvider: "pixpay",
  }), true);
  assert.equal(isPixPayManualPayoutProcessable("pixpay", "pending_manual", {
    paymentProvider: "afribapay",
  }), false);
  assert.equal(isPixPayManualPayoutProcessable("pixpay", "pending", {
    paymentProvider: "pixpay",
  }), false);
});

test("payout status lookup uses the current provider reference without unsafe fallbacks", () => {
  assert.equal(resolvePayoutStatusLookupReference("afribapay", {
    reference: "ashtech-ref",
    externalReference: "current-afriba-order",
  }), "current-afriba-order");
  assert.equal(resolvePayoutStatusLookupReference("pixpay", {
    reference: "ashtech-ref",
    externalReference: null,
  }), "ashtech-ref");
  assert.equal(resolvePayoutStatusLookupReference("pawapay", {
    reference: "ashtech-ref",
    externalReference: "current-pawapay-uuid",
  }), "current-pawapay-uuid");
  assert.equal(resolvePayoutStatusLookupReference("pawapay", {
    reference: "ashtech-ref",
    externalReference: null,
  }), null);
  assert.equal(resolvePayoutStatusLookupReference("izichange", {
    reference: "ashtech-ref",
    externalReference: null,
  }, "current-izi-id"), "current-izi-id");
  assert.equal(resolvePayoutStatusLookupReference("izichange", {
    reference: "ashtech-ref",
    externalReference: null,
  }), null);
});

test("provider status polling continues forever and switches to two-minute checks after 30 minutes", () => {
  const minute = 60 * 1000;
  const twoMinutes = 2 * minute;
  const day = 24 * 60 * minute;

  assert.equal(providerStatusPollIntervalMs(0, 0), minute);
  assert.equal(providerStatusPollIntervalMs(0, 30 * minute), twoMinutes);
  assert.equal(providerStatusPollIntervalMs(0, 2 * 60 * minute), twoMinutes);
  assert.equal(providerStatusPollIntervalMs(0, day), twoMinutes);
  assert.equal(providerStatusPollIntervalMs(0, 365 * day), twoMinutes);

  const startedAt = 1_000_000;
  const now = startedAt + minute;
  assert.equal(isProviderStatusPollDue(startedAt, now - minute + 1, now), false);
  assert.equal(isProviderStatusPollDue(startedAt, now - minute, now), true);
  assert.equal(isProviderStatusPollDue(startedAt, 0, now), true);
});

test("recovered provider lookups are deterministically spread over one minute", () => {
  const now = 2_000_000_000_000;
  const startedAt = now - 8 * 24 * 60 * 60 * 1000;
  const lastCheckedAt = recoveredStatusPollLastCheckedAt("tx-reference", startedAt, now);
  const interval = providerStatusPollIntervalMs(startedAt, now);

  assert.equal(
    recoveredStatusPollLastCheckedAt("tx-reference", startedAt, now),
    lastCheckedAt,
  );
  assert.ok(now - lastCheckedAt >= interval - 60_000);
  assert.ok(now - lastCheckedAt < interval);
});

test("async status cache coalesces requests and expires values", async () => {
  let now = 100;
  let loads = 0;
  const cache = createAsyncTtlCache<string, number>(10, () => now);
  const load = async () => {
    loads++;
    await Promise.resolve();
    return loads;
  };

  const [first, concurrent] = await Promise.all([
    cache.get("provider-id", load),
    cache.get("provider-id", load),
  ]);
  assert.equal(first, 1);
  assert.equal(concurrent, 1);
  assert.equal(loads, 1);

  now = 109;
  assert.equal(await cache.get("provider-id", load), 1);
  assert.equal(loads, 1);

  now = 110;
  assert.equal(await cache.get("provider-id", load), 2);
  assert.equal(loads, 2);
});