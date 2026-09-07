import assert from "node:assert/strict";
import test from "node:test";
import {
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