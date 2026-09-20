import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  AFRIBAPAY_MAX_PAYIN_AMOUNT,
  AFRIBAPAY_MIN_PAYIN_AMOUNT,
  parseAfribaPayWebhook,
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
});

test("AfribaPay payin amount validation uses the conservative documented range", () => {
  assert.equal(validateAfribaPayinAmount(AFRIBAPAY_MIN_PAYIN_AMOUNT), undefined);
  assert.equal(validateAfribaPayinAmount(AFRIBAPAY_MAX_PAYIN_AMOUNT), undefined);
  assert.match(validateAfribaPayinAmount(99) || "", /supérieur ou égal/);
  assert.match(validateAfribaPayinAmount(AFRIBAPAY_MAX_PAYIN_AMOUNT + 1) || "", /inférieur ou égal/);
});