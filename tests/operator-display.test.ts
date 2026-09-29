import test from "node:test";
import assert from "node:assert/strict";
import { getOperatorDisplayName, operatorNamesMatch } from "../shared/operator-display";

test("T-Money spellings are displayed as Mixx By Yas", () => {
  for (const legacyName of ["T-Money", "T Money", "TMoney", "T_Money"]) {
    assert.equal(getOperatorDisplayName(legacyName), "Mixx By Yas");
  }
});

test("Mixx By Yas matches legacy names without changing other operators", () => {
  assert.equal(operatorNamesMatch("T-Money", "Mixx By Yas"), true);
  assert.equal(operatorNamesMatch("T Money", "Mixx By Yas"), true);
  assert.equal(operatorNamesMatch("MTN Money", "Mixx By Yas"), false);
  assert.equal(getOperatorDisplayName("MTN Money"), "MTN Money");
});