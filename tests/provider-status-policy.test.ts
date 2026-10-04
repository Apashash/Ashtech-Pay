import assert from "node:assert/strict";
import test from "node:test";
import {
  createAsyncTtlCache,
  isProviderStatusPollDue,
  providerStatusPollIntervalMs,
  recoveredStatusPollLastCheckedAt,
} from "../server/providerStatusPolicy.ts";
import {
  isPixPayManualPayoutProcessable,
  isPixPayPayoutProvider,
  normalizePayoutStatusProvider,
  resolvePayoutStatusLookupReference,
  shouldUseManualPayoutStatusOverride,
} from "../server/providerStatusReferences.ts";

test("admin reconciliation recognizes only supported payout providers", () => {
  assert.equal(normalizePayoutStatusProvider(" AfribaPay "), "afribapay");
  assert.equal(normalizePayoutStatusProvider("PIXPay"), "pixpay");
  assert.equal(normalizePayoutStatusProvider("pawapay"), "pawapay");
  assert.equal(normalizePayoutStatusProvider("izichange"), "izichange");
  assert.equal(normalizePayoutStatusProvider("manual"), null);
  assert.equal(normalizePayoutStatusProvider(null), null);
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

test("provider status polling backs off progressively without expiring transactions", () => {
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  assert.equal(providerStatusPollIntervalMs(0, 0), minute);
  assert.equal(providerStatusPollIntervalMs(0, 30 * minute), 5 * minute);
  assert.equal(providerStatusPollIntervalMs(0, 2 * hour), 15 * minute);
  assert.equal(providerStatusPollIntervalMs(0, day), hour);
  assert.equal(providerStatusPollIntervalMs(0, 7 * day), 6 * hour);

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