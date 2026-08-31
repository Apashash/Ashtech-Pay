import assert from "node:assert/strict";
import test from "node:test";
import { normalizePixPayPhone } from "../server/pixpay.ts";

test("PixPay keeps Cameroon withdrawal/send digits exactly as entered", () => {
  assert.equal(
    normalizePixPayPhone("683677872", "CM", { preserveCameroonInput: true }),
    "683677872",
  );
  assert.equal(
    normalizePixPayPhone("0683677872", "CM", { preserveCameroonInput: true }),
    "0683677872",
  );
  assert.equal(
    normalizePixPayPhone("+237 683 677 872", "CM", { preserveCameroonInput: true }),
    "237683677872",
  );
});

test("PixPay keeps the existing Cameroon deposit normalization", () => {
  assert.equal(normalizePixPayPhone("683677872", "CM"), "0683677872");
  assert.equal(normalizePixPayPhone("+237683677872", "CM"), "0683677872");
});

test("PixPay keeps the existing leading-zero normalization for other countries", () => {
  assert.equal(normalizePixPayPhone("708126834", "CI"), "0708126834");
  assert.equal(normalizePixPayPhone("+2250708126834", "CI"), "0708126834");
});