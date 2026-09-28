import test from "node:test";
import assert from "node:assert/strict";
import { extractIziPayProviderReference } from "../server/izichange";

test("extracts an IziChange ID from a wrapped payment object", () => {
  assert.equal(
    extractIziPayProviderReference({
      object: {
        id: "evt_wrapper",
        paymentIntent: { id: "izi_payment_123" },
      },
    }),
    "izi_payment_123",
  );
});

test("extracts supported snake-case provider IDs", () => {
  assert.equal(
    extractIziPayProviderReference({
      payin: { transaction_id: "izi_payin_456" },
    }),
    "izi_payin_456",
  );
});

test("returns undefined when event data has no payment resource ID", () => {
  assert.equal(
    extractIziPayProviderReference({ event: "payment_intent.completed" }),
    undefined,
  );
});

test("does not mistake a webhook envelope ID for a payment ID", () => {
  assert.equal(
    extractIziPayProviderReference({
      type: "payment_intent.completed",
      id: "webhook_event_789",
      merchantReference: "ASHPAY-123",
    }),
    undefined,
  );
});