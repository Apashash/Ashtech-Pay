import assert from "node:assert/strict";
import test from "node:test";
import {
  getAfribaPayPayoutPhone,
  toLocalMobileMoneyPhone,
  validateMobileMoneyPhone,
} from "../shared/mobile-money-phone.ts";

test("normalizes an international Togo number for the provider", () => {
  assert.equal(toLocalMobileMoneyPhone("+228 73 03 95 33", "TG"), "73039533");
  assert.equal(toLocalMobileMoneyPhone("0022873039533", "TG"), "73039533");
});

test("accepts valid Togo numbers regardless of selected operator", () => {
  assert.equal(validateMobileMoneyPhone("22873039533", "TG"), null);
  assert.equal(validateMobileMoneyPhone("22890123456", "TG"), null);
});

test("rejects a Togo number with the wrong length", () => {
  const error = validateMobileMoneyPhone("2287303953", "TG");
  assert.match(error || "", /8 chiffres/);
});

test("AfribaPay Benin payout preserves the exact phone input", () => {
  const enteredPhone = " +229 01 23 45 67 89 ";
  assert.equal(
    getAfribaPayPayoutPhone(enteredPhone, "BJ", "123456789"),
    enteredPhone,
  );
});

test("other AfribaPay payout countries retain their existing formatting", () => {
  assert.equal(
    getAfribaPayPayoutPhone("+228 73 03 95 33", "TG", "73039533"),
    "73039533",
  );
});