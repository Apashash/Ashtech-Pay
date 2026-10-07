import test from "node:test";
import assert from "node:assert/strict";
import {
  getSandboxCollectScenario,
  isSandboxTestTransaction,
  sandboxLocalPhoneForStatus,
  sandboxPhoneForStatus,
} from "../server/sandboxTestNumbers";
import { buildTransactionBalanceSnapshots } from "../server/transactionBalances";

test("sandbox numbers resolve by country dial code", () => {
  assert.equal(getSandboxCollectScenario("+237000000001", "+237"), "success");
  assert.equal(getSandboxCollectScenario("237 000 000 002", "+237"), "pending");
  assert.equal(getSandboxCollectScenario("000000003", "+237"), "failed");
  assert.equal(getSandboxCollectScenario("+221000000004", "+221"), "otp_required");
  assert.equal(getSandboxCollectScenario("+237000000001", "+221"), null);
});

test("sandbox number builders expose local and international forms", () => {
  assert.equal(sandboxPhoneForStatus("+237", "success"), "+237000000001");
  assert.equal(sandboxLocalPhoneForStatus("cancelled"), "000000005");
});

test("sandbox OTP accepts only the documented fake code", () => {
  assert.equal(getSandboxCollectScenario("+237000000004", "+237"), "otp_required");
});

test("sandbox history records are identified even when metadata is stored as JSON text", () => {
  assert.equal(isSandboxTestTransaction({
    type: "sandbox_test",
    source: "sandbox",
    metadata: JSON.stringify({ sandboxTest: true }),
  }), true);
  assert.equal(isSandboxTestTransaction({ type: "deposit", source: "api" }), false);
});

test("sandbox history records never receive reconstructed wallet balance snapshots", () => {
  const snapshots = buildTransactionBalanceSnapshots(
    [{
      id: "sandbox-test-1",
      userId: "user-1",
      type: "sandbox_test",
      amount: "5000.00",
      currency: "XAF",
      status: "sandbox_test",
      source: "sandbox",
      metadata: { sandboxTest: true },
      createdAt: new Date(),
    } as any],
    "XAF",
    10000,
    [],
  );

  assert.equal(snapshots.has("sandbox-test-1"), false);
});