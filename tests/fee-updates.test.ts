import assert from "node:assert/strict";
import test from "node:test";
import { buildPawaPayFeeUpdates } from "../server/feeUpdates";

test("PawaPay fee updates preserve an explicit zero and separate margin", () => {
  assert.deepEqual(
    buildPawaPayFeeUpdates(
      { pawapayFee: "0", ashtechMargin: "2.5", isActive: true },
      { pawapayFee: "3", ashtechMargin: "1" },
    ),
    {
      pawapayFee: "0",
      ashtechMargin: "2.5",
      feeValue: "2.5000",
      isActive: true,
    },
  );
});

test("PawaPay fee updates retain omitted values and reject negative rates", () => {
  assert.deepEqual(
    buildPawaPayFeeUpdates({ isActive: false }, { pawapayFee: "1.25", ashtechMargin: "0.75" }),
    { isActive: false },
  );
  assert.throws(
    () => buildPawaPayFeeUpdates({ pawapayFee: "-1", ashtechMargin: "2" }),
    /Taux invalide/,
  );
});