import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProviderErrorPayload,
  extractProviderErrorMessage,
  extractProviderErrorDetails,
} from "../server/providerErrors";

test("provider errors retain the upstream message and safe diagnostics", () => {
  const payload = buildProviderErrorPayload({
    error: "gateway_error",
    message: "Le solde du portefeuille mobile est insuffisant.",
    fallback: "Paiement impossible.",
    provider: "pixpay",
    raw: {
      error: "insufficient_balance",
      statut_code: 422,
      api_key: "must-not-be-exposed",
    },
  });

  assert.deepEqual(payload, {
    error: "gateway_error",
    message: "Le solde du portefeuille mobile est insuffisant.",
    provider_code: "insufficient_balance",
    provider_status: 422,
  });
  assert.equal("api_key" in payload, false);
  assert.equal("raw" in payload, false);
});

test("provider error details are found in nested response formats", () => {
  assert.deepEqual(
    extractProviderErrorDetails({
      data: {
        error_code: "operator_rejected",
        status_code: "409",
      },
    }),
    {
      providerCode: "operator_rejected",
      providerStatus: 409,
    },
  );
});

test("provider errors redact echoed phone numbers and sensitive request values", () => {
  const payload = buildProviderErrorPayload({
    error: "gateway_error",
    message: "Transaction refusée pour +237 690 12 34 56 avec token secret-token-123.",
    fallback: "Paiement impossible.",
    sensitiveValues: ["secret-token-123"],
  });

  assert.equal(
    payload.message,
    "Transaction refusée pour [redacted] avec token [redacted].",
  );
});

test("provider error messages do not expose the upstream provider name", () => {
  const payload = buildProviderErrorPayload({
    error: "gateway_error",
    message: "PixPay et AfribaPay ont refusé la transaction via IziChange.",
    fallback: "Paiement impossible.",
    provider: "pixpay",
  });

  assert.equal(
    payload.message,
    "le fournisseur de paiement et le fournisseur de paiement ont refusé la transaction via le fournisseur de paiement.",
  );
  assert.equal("provider" in payload, false);
});

test("provider errors redact the PawaPay brand", () => {
  const payload = buildProviderErrorPayload({
    error: "gateway_error",
    message: "PawaPay rejected this payment.",
    fallback: "Paiement impossible.",
  });
  assert.equal(payload.message, "le fournisseur de paiement rejected this payment.");
});

test("provider errors use the documented fallback when the provider sends no message", () => {
  const payload = buildProviderErrorPayload({
    error: "gateway_error",
    message: "   ",
    fallback: "Le fournisseur de paiement n'a fourni aucun détail.",
    provider: "afribapay",
  });

  assert.deepEqual(payload, {
    error: "gateway_error",
    message: "Le fournisseur de paiement n'a fourni aucun détail.",
  });
});

test("provider errors extract PawaPay failure reasons from nested responses", () => {
  const payload = buildProviderErrorPayload({
    error: "payment_initiation_failed",
    fallback: "Paiement impossible.",
    raw: {
      data: {
        failureReason: "PawaPay rejected the payment for +237 690 12 34 56.",
        errorCode: "OPERATOR_PAYER_NOT_FOUND",
      },
      status_code: "422",
    },
    sensitiveValues: ["+237 690 12 34 56"],
  });

  assert.deepEqual(payload, {
    error: "payment_initiation_failed",
    message: "le fournisseur de paiement rejected the payment for [redacted].",
    provider_code: "OPERATOR_PAYER_NOT_FOUND",
    provider_status: 422,
  });
  assert.equal(
    extractProviderErrorMessage({ errorMessage: "Mobile Money account is unavailable." }),
    "Mobile Money account is unavailable.",
  );
});