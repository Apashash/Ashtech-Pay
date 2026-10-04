import assert from "node:assert/strict";
import test from "node:test";
import { getWithdrawalProviderReference } from "../shared/withdrawalProviderReference";

test("shows the provider-returned reference instead of the internal lookup reference", () => {
  assert.equal(
    getWithdrawalProviderReference({
      reference: "ASHPAY-WIT-ORDER1",
      externalReference: "ASHPAY-WIT-ORDER1",
      metadata: {
        paymentProvider: "afribapay",
        providerReference: "AFRIBA-TXN-92841",
      },
    }),
    "AFRIBA-TXN-92841",
  );
});

test("does not label a legacy AfribaPay order_id as a provider reference", () => {
  assert.equal(
    getWithdrawalProviderReference({
      reference: "ASHPAY-WIT-ORDER1",
      externalReference: "ASHPAY-WIT-ORDER1",
      metadata: { paymentProvider: "afribapay" },
    }),
    null,
  );
});

test("hides internal retry references when no provider reference was returned", () => {
  assert.equal(
    getWithdrawalProviderReference({
      reference: "ASHPAY-WIT-ORDER1",
      externalReference: "ASHPAY-WIT-ORDER1-RABC123",
      metadata: { paymentProvider: "pixpay" },
    }),
    null,
  );
});

test("keeps provider IDs in externalReference for PixPay and PawaPay", () => {
  assert.equal(
    getWithdrawalProviderReference({
      reference: "ASHPAY-WIT-ORDER1",
      externalReference: "PIX_837192",
      metadata: { paymentProvider: "pixpay" },
    }),
    "PIX_837192",
  );
  assert.equal(
    getWithdrawalProviderReference({
      reference: "ASHPAY-WIT-ORDER2",
      externalReference: "f63f1b38-9862-4e53-9c1d-dbb1d7918122",
      metadata: { paymentProvider: "pawapay" },
    }),
    "f63f1b38-9862-4e53-9c1d-dbb1d7918122",
  );
});

test("reads provider reference metadata returned as serialized JSON", () => {
  assert.equal(
    getWithdrawalProviderReference({
      reference: "ASHPAY-WIT-ORDER1",
      externalReference: "ASHPAY-WIT-ORDER1",
      metadata: '{"paymentProvider":"afribapay","providerReference":"AFRIBA-TXN-92841"}',
    }),
    "AFRIBA-TXN-92841",
  );
});