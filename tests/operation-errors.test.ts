import test from "node:test";
import assert from "node:assert/strict";
import { isAdminBlockedOperationError } from "../client/src/lib/operation-errors.ts";

test("recognizes every admin blocked operation code", () => {
  for (const code of ["WITHDRAWAL_BLOCKED", "OPERATOR_DISABLED_BY_ADMIN", "OPERATION_DISABLED_BY_ADMIN"]) {
    assert.equal(isAdminBlockedOperationError({ code }), true);
  }
});

test("does not classify unrelated or malformed errors as admin blocked", () => {
  assert.equal(isAdminBlockedOperationError({ code: "OTP_LOCKED" }), false);
  assert.equal(isAdminBlockedOperationError(new Error("blocked")), false);
  assert.equal(isAdminBlockedOperationError(null), false);
  assert.equal(isAdminBlockedOperationError("WITHDRAWAL_BLOCKED"), false);
});