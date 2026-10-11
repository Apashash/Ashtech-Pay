import test from "node:test";
import assert from "node:assert/strict";
import { REFERRAL_RULES, isReferralTransaction, referralFee, referralPromoActive } from "../shared/referral-policy";

test("promotion starts inclusively, ends exclusively at 120 hours, and cancellation wins", () => {
  const start = new Date("2026-10-11T12:00:00Z");
  const end = new Date(start.getTime() + REFERRAL_RULES.durationDays * 86400000);
  assert.equal(end.getTime() - start.getTime(), 120 * 3600000);
  assert.equal(referralPromoActive(start, end, null, start.getTime() - 1), false);
  assert.equal(referralPromoActive(start, end, null, start.getTime()), true);
  assert.equal(referralPromoActive(start, end, null, end.getTime() - 1), true);
  assert.equal(referralPromoActive(start, end, null, end.getTime()), false);
  assert.equal(referralPromoActive(start, end, start, start.getTime()), false);
});

test("actual provider cost plus 0.3 percent, never a higher fee or a false -50% promise", () => {
  assert.deepEqual(referralFee(10000, 1.5, 500), { total: 180, margin: 30, providerFee: 150 });
  assert.equal(referralFee(10000, 1.5, 170), null);
  assert.equal(referralFee(10000, 1.5, 180), null);
  assert.deepEqual(referralFee(10000, 0, 200), { total: 30, margin: 30, providerFee: 0 });
  assert.throws(() => referralFee(10000, Number.NaN, 500));
  assert.throws(() => referralFee(-1, 1, 500));
});

test("only confirmed real personal deposits/withdrawals qualify", () => {
  const base = { type: "deposit", status: "completed", paymentMethod: "mobile_money" };
  assert.equal(isReferralTransaction(base), true);
  assert.equal(isReferralTransaction({ ...base, type: "withdrawal" }), true);
  for (const status of ["pending", "processing", "pending_manual", "failed", "cancelled", "sandbox_test", "refunded"]) {
    assert.equal(isReferralTransaction({ ...base, status }), false);
  }
  for (const type of ["transfer_out", "transfer_in", "payment_link", "conversion"]) {
    assert.equal(isReferralTransaction({ ...base, type }), false);
  }
  for (const source of ["api", "direct_sdk", "hosted_page", "sandbox"]) {
    assert.equal(isReferralTransaction({ ...base, source }), false);
  }
  assert.equal(isReferralTransaction({ ...base, paymentLinkId: "link" }), false);
  assert.equal(isReferralTransaction({ ...base, paymentIntentId: "intent" }), false);
  for (const metadata of [{ sandbox: true }, { simulation: true }, { refunded: true }, { refundProcessed: true }]) {
    assert.equal(isReferralTransaction({ ...base, metadata }), false);
  }
});
