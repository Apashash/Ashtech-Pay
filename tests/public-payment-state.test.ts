import assert from "node:assert/strict";
import test from "node:test";
import { buildPublicPaymentStatus } from "../server/publicPaymentState.ts";

test("public status exposes a provider redirect without contacting the provider", () => {
  assert.deepEqual(
    buildPublicPaymentStatus({
      status: "pending",
      reference: "ASHPAY-PAY-123456",
      metadata: {
        authorizationUrl: "https://provider.example/authorize",
        nextStep: "REDIRECT_AUTH",
        authType: "REDIRECT_AUTH",
      },
    }),
    {
      status: "pending",
      state: "redirect",
      reference: "ASHPAY-PAY-123456",
      description: undefined,
      failureReason: null,
      authorizationUrl: "https://provider.example/authorize",
      nextStep: "REDIRECT_AUTH",
      authType: "REDIRECT_AUTH",
      providerStatusUnavailable: false,
    },
  );
});

test("public status keeps terminal failure reasons and rejects unknown auth types", () => {
  assert.deepEqual(
    buildPublicPaymentStatus({
      status: "failed",
      reference: "ASHPAY-PAY-654321",
      description: null,
      metadata: {
        authType: "INTERNAL_SECRET",
        failureReason: {
          failureCode: "OPERATOR_TRANSACTION_DECLINED",
          failureMessage: "Transaction refusée par l'opérateur.",
        },
      },
    }),
    {
      status: "failed",
      state: "failed",
      reference: "ASHPAY-PAY-654321",
      description: "Transaction refusée par l'opérateur.",
      failureReason: {
        failureCode: "OPERATOR_TRANSACTION_DECLINED",
        failureMessage: "Transaction refusée par l'opérateur.",
      },
      authorizationUrl: null,
      nextStep: null,
      authType: null,
      providerStatusUnavailable: false,
    },
  );
});

test("public status maps preauthorisation and phone confirmation states", () => {
  assert.equal(
    buildPublicPaymentStatus({
      status: "pending",
      reference: "ASHPAY-PAY-111111",
      metadata: { authType: "PREAUTH" },
    }).state,
    "preauthorisation",
  );
  assert.equal(
    buildPublicPaymentStatus({
      status: "pending",
      reference: "ASHPAY-PAY-222222",
      metadata: { authType: "PROVIDER_AUTH" },
    }).state,
    "confirm_phone",
  );
});