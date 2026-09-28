import test from "node:test";
import assert from "node:assert/strict";
import {
  getMaintenanceResponseKind,
  normalizeServiceMaintenancePayload,
  SERVICE_MAINTENANCE_MESSAGE,
} from "../server/platformMaintenance";

test("maintenance mode returns an HTML response for public checkout pages", () => {
  assert.equal(getMaintenanceResponseKind("/pay/order-123"), "html");
  assert.equal(getMaintenanceResponseKind("/hpay/session-123"), "html");
  assert.equal(getMaintenanceResponseKind("/checkout/transaction-123"), "html");
});

test("maintenance mode returns JSON for merchant APIs and public payment operations", () => {
  assert.equal(getMaintenanceResponseKind("/v1/collect"), "json");
  assert.equal(getMaintenanceResponseKind("/v1/crypto/collect"), "json");
  assert.equal(getMaintenanceResponseKind("/api/v1/crypto/collect"), "json");
  assert.equal(getMaintenanceResponseKind("/v1/transaction/tx-123"), "json");
  assert.equal(getMaintenanceResponseKind("/api/deposits"), "json");
  assert.equal(getMaintenanceResponseKind("/api/deposits/crypto/address"), "json");
  assert.equal(getMaintenanceResponseKind("/api/deposits/confirm-otp"), "json");
  assert.equal(getMaintenanceResponseKind("/api/v1/hosted-payment/create"), "json");
  assert.equal(getMaintenanceResponseKind("/api/payment-links/public/slug"), "json");
  assert.equal(getMaintenanceResponseKind("/api/payment-links/slug/pay"), "json");
  assert.equal(getMaintenanceResponseKind("/api/payment-links/slug/confirm-otp"), "json");
  assert.equal(getMaintenanceResponseKind("/api/public/hosted-session/session-123/status"), "json");
  assert.equal(getMaintenanceResponseKind("/api/checkout/transaction-123"), "json");
});

test("maintenance mode leaves admin, webhooks, and existing PDF delivery alone", () => {
  assert.equal(getMaintenanceResponseKind("/api/admin/settings"), null);
  assert.equal(getMaintenanceResponseKind("/api/public/maintenance"), null);
  assert.equal(getMaintenanceResponseKind("/api/afribapay/webhook"), null);
  assert.equal(getMaintenanceResponseKind("/api/payment-links/slug/download-pdf/ref"), null);
  assert.equal(getMaintenanceResponseKind("/api/payment-links"), null);
  assert.equal(getMaintenanceResponseKind("/v10/collect"), null);
});

test("production error sanitization preserves only the fixed maintenance response", () => {
  assert.deepEqual(
    normalizeServiceMaintenancePayload({
      error: "service_maintenance",
      code: "SERVICE_MAINTENANCE",
      message: "untrusted message",
    }),
    {
      error: "service_maintenance",
      code: "SERVICE_MAINTENANCE",
      message: SERVICE_MAINTENANCE_MESSAGE,
    },
  );
  assert.equal(
    normalizeServiceMaintenancePayload({ error: "server_error", code: "SERVICE_MAINTENANCE" }),
    null,
  );
});