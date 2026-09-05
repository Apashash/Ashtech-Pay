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

test("rejects a Flooz number selected as T-Money", () => {
  const error = validateMobileMoneyPhone("22873039533", "TG", "T-Money");
  assert.match(error || "", /Flooz \(Moov\)/);
});

test("accepts matching Togo operator ranges", () => {
  assert.equal(validateMobileMoneyPhone("22873039533", "TG", "Flooz (Moov)"), null);
  assert.equal(validateMobileMoneyPhone("22890123456", "TG", "T-Money"), null);
});

test("rejects a T-Money number selected as Flooz", () => {
  const error = validateMobileMoneyPhone("22890123456", "TG", "Flooz (Moov)");
  assert.match(error || "", /T-Money/);
});