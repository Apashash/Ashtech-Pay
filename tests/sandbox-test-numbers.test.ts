import test from "node:test";
import assert from "node:assert/strict";
import {
  getSandboxCollectScenario,
  sandboxLocalPhoneForStatus,
  sandboxPhoneForStatus,
} from "../server/sandboxTestNumbers";

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