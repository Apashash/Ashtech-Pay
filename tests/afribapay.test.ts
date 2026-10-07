import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  AFRIBAPAY_MAX_PAYIN_AMOUNT,
  AFRIBAPAY_MIN_PAYIN_AMOUNT,
  buildAfribaPayStatusUrl,
  classifyAfribaPayinStatus,
  classifyAfribaPayoutStatus,
  isRetryableAfribaOtpRejection,
  parseAfribaPayWebhook,
  resolveAfribaPayPayoutOrderId,
  resolveAfribaPayPayinTransactionId,
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
  const documentedPayoutCallback = parseAfribaPayWebhook({
    order_id: "merchant-order-1",
    transaction_id: "POM123",
    reference_id: "merchant-ref",
    status: "SUCCESS",
  });
  assert.deepEqual(documentedPayoutCallback, {
    order_id: "merchant-order-1",
    transaction_id: "POM123",
    reference_id: "merchant-ref",
    status: "completed",
  });

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
  assert.equal(classifyAfribaPayoutStatus(503, "FAILED"), "pending");
  assert.equal(classifyAfribaPayoutStatus(200, "NOT_FOUND"), "pending");
  assert.equal(classifyAfribaPayoutStatus(200, "ERROR"), "pending");
  assert.equal(classifyAfribaPayoutStatus(200, "FAILED"), "failed");
  assert.equal(classifyAfribaPayoutStatus(200, "SUCCESS"), "completed");
});

test("AfribaPay payout status uses the documented shared API host and safely encodes order_id", () => {
  assert.equal(
    buildAfribaPayStatusUrl("payout/id 123"),
    "https://api.afribapay.com/v1/status?order_id=payout%2Fid+123",
  );
  assert.equal(
    buildAfribaPayStatusUrl("POM123", "transaction_id"),
    "https://api.afribapay.com/v1/status?transaction_id=POM123",
  );
});

test("AfribaPay payout retry polls the provider-returned order_id, not the prior attempt", () => {
  assert.equal(
    resolveAfribaPayPayoutOrderId(" AFRIBA-NEW-ORDER ", "ASHPAY-ORDER-RNEW"),
    "AFRIBA-NEW-ORDER",
  );
  assert.equal(
    resolveAfribaPayPayoutOrderId(undefined, "ASHPAY-ORDER-RNEW"),
    "ASHPAY-ORDER-RNEW",
  );
});

test("AfribaPay pay-in lookup errors and missing IDs remain pending", () => {
  assert.equal(classifyAfribaPayinStatus(404, "FAILED"), "pending");
  assert.equal(classifyAfribaPayinStatus(503, "SUCCESS"), "pending");
  assert.equal(classifyAfribaPayinStatus(200, "NOT_FOUND"), "pending");
  assert.equal(classifyAfribaPayinStatus(200, "ERROR"), "pending");
  assert.equal(classifyAfribaPayinStatus(200, "FAILED"), "failed");
  assert.equal(classifyAfribaPayinStatus(200, "SUCCESS"), "completed");
});

test("AfribaPay status uses only a distinct provider transaction ID", () => {
  assert.equal(resolveAfribaPayPayinTransactionId("provider-tx", "ashtech-order"), "provider-tx");
  assert.equal(resolveAfribaPayPayinTransactionId(" ashtech-order ", "ashtech-order"), null);
  assert.equal(resolveAfribaPayPayinTransactionId("   ", "ashtech-order"), null);
  assert.equal(resolveAfribaPayPayinTransactionId(undefined, "ashtech-order"), null);
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