import assert from "node:assert/strict";
import test from "node:test";
import { parsePhoneInput } from "../shared/user-phone.ts";

test("normalizes common international phone formatting to digits", () => {
  assert.deepEqual(
    parsePhoneInput("+237 (6) 78-12.34.56"),
    { ok: true, phone: "237678123456" },
  );
});

test("allows an omitted or blank optional phone", () => {
  assert.deepEqual(parsePhoneInput(undefined), { ok: true, phone: null });
  assert.deepEqual(parsePhoneInput(null), { ok: true, phone: null });
  assert.deepEqual(parsePhoneInput("   "), { ok: true, phone: null });
});

test("rejects alphabetic and mixed phone strings instead of storing them", () => {
  assert.deepEqual(parsePhoneInput("Bizboy"), { ok: false });
  assert.deepEqual(parsePhoneInput("2376XXXXXXXX"), { ok: false });
  assert.deepEqual(parsePhoneInput("+225057450950xEcC9f10cC20b07853"), { ok: false });
  assert.deepEqual(parsePhoneInput("+225xEcC9f10cC20b07835E63fc608"), { ok: false });
});

test("rejects misplaced plus signs, punctuation-only input, and non-string values", () => {
  assert.deepEqual(parsePhoneInput("225+057"), { ok: false });
  assert.deepEqual(parsePhoneInput("-.()"), { ok: false });
  assert.deepEqual(parsePhoneInput(237678123456), { ok: false });
});