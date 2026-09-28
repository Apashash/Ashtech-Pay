import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  AFRIBAPAY_MAX_PAYIN_AMOUNT,
  AFRIBAPAY_MIN_PAYIN_AMOUNT,
  classifyAfribaPayoutStatus,
  isRetryableAfribaOtpRejection,
  parseAfribaPayWebhook,
  shouldCheckAfribaPayOrderIdFallback,
  validateAfribaPayinAmount,
  verifyAfribaPayWebhookSignature,
} from "../server/afribapay";

test("AfribaPay webhook signature validates the exact raw body", () => {
  const body = Buffer.from('{"status":"SUCCESS","transaction_id":"tx-1"}');
  const secret = "test-afribapay-api-key";
  const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");

  assert.equal(verifyAfribaPayWebhookSignature(body, signature, secret), true);
  assert.equal(verifyAfribaPayWebhookSignature(body, `sha256=${signature}`, secret), true);
  assert.equal(verifyAfribaPayWebhookSignature(Buffer.from(`${body} `), signature, secret), false);
  assert.equal(verifyAfribaPayWebhookSignature(body, signature, "wrong-secret"), false);

  const timestamp = "1720000000";
  const timestampSignature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body.toString("utf8")}`)
    .digest("hex");
  assert.equal(verifyAfribaPayWebhookSignature(body, timestampSignature, secret, timestamp), true);
});

test("AfribaPay webhook parser keeps reference_id and terminal statuses", () => {
  const parsed = parseAfribaPayWebhook({
    data: {
      reference_id: "merchant-ref",
      transaction_id: "provider-tx",
      status: "APPROVED",
    },
  });
  assert.equal(parsed.order_id, undefined);
  assert.equal(parsed.reference_id, "merchant-ref");
  assert.equal(parsed.transaction_id, "provider-tx");
  assert.equal(parsed.status, "completed");
  assert.equal(parseAfribaPayWebhook({ status: "EXPIRED" }).status, "failed");
  assert.equal(parseAfribaPayWebhook({ status: "PENDING" }).status, "pending");
  assert.equal(parseAfribaPayWebhook({ status: "NOT_FOUND" }).status, "pending");
});

test("AfribaPay payout HTTP 404 and NOT_FOUND are non-final", () => {
  assert.equal(classifyAfribaPayoutStatus(404, "FAILED"), "pending");
  assert.equal(classifyAfribaPayoutStatus(404, "NOT_FOUND"), "pending");
  assert.equal(classifyAfribaPayoutStatus(200, "NOT_FOUND"), "pending");
  assert.equal(classifyAfribaPayoutStatus(200, "FAILED"), "failed");
  assert.equal(classifyAfribaPayoutStatus(200, "SUCCESS"), "completed");
});

test("AfribaPay AshTech order_id fallback is only checked after 24h while still pending", () => {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = 2_000_000_000_000;

  assert.equal(shouldCheckAfribaPayOrderIdFallback("pending", now - dayMs + 1, now), false);
  assert.equal(shouldCheckAfribaPayOrderIdFallback("pending", now - dayMs, now), true);
  assert.equal(shouldCheckAfribaPayOrderIdFallback("pending", now - dayMs - 1, now), true);
  assert.equal(shouldCheckAfribaPayOrderIdFallback("completed", now - dayMs - 1, now), false);
  assert.equal(shouldCheckAfribaPayOrderIdFallback("failed", now - dayMs - 1, now), false);
});

test("AfribaPay payin amount validation uses the conservative documented range", () => {
  assert.equal(validateAfribaPayinAmount(AFRIBAPAY_MIN_PAYIN_AMOUNT), undefined);
  assert.equal(validateAfribaPayinAmount(AFRIBAPAY_MAX_PAYIN_AMOUNT), undefined);
  assert.match(validateAfribaPayinAmount(99) || "", /supérieur ou égal/);
  assert.match(validateAfribaPayinAmount(AFRIBAPAY_MAX_PAYIN_AMOUNT + 1) || "", /inférieur ou égal/);
});

test("AfribaPay OTP rejection classifier keeps invalid codes retryable only", () => {
  assert.equal(isRetryableAfribaOtpRejection({
    message: "Code OTP invalide ou expiré",
    providerCode: "invalid_otp",
  }), true);
  assert.equal(isRetryableAfribaOtpRejection({
    message: "OTP rejected by the operator",
  }), true);
  assert.equal(isRetryableAfribaOtpRejection({
    message: "Internal server error",
    providerCode: "server_error",
  }), false);
  assert.equal(isRetryableAfribaOtpRejection({
    message: "Amount is outside the allowed range",
    providerCode: "amount_out_of_range",
  }), false);
});