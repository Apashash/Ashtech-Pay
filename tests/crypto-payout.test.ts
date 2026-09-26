import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCryptoPayout,
  isDefinitiveIziPayoutRejection,
  parseCryptoPayoutFeeConfig,
  resolveCryptoPayoutFee,
} from "../server/cryptoPayout";
import { getIziPayPayoutBaseUrlForMode, normalizeIziPayoutResponse } from "../server/izichange";

test("crypto payout fee configuration supports country overrides and global fallback", () => {
  const config = parseCryptoPayoutFeeConfig(JSON.stringify({
    global: { "usdt.trc20": { fixedUsdt: 1, percentage: 2 } },
    countries: { "country-cm": { "USDT.TRC20": { fixedUsdt: 0.5, percentage: 1 } } },
  }));

  assert.deepEqual(resolveCryptoPayoutFee(config, "country-cm", "USDT.TRC20"), {
    fixedUsdt: 0.5,
    percentage: 1,
  });
  assert.deepEqual(resolveCryptoPayoutFee(config, "country-ci", "USDT.TRC20"), {
    fixedUsdt: 1,
    percentage: 2,
  });
  assert.deepEqual(resolveCryptoPayoutFee(config, undefined, "USDT.ERC20"), {
    fixedUsdt: 0,
    percentage: 0,
  });
});

test("recipient-paid fee is deducted from payout while sender-paid fee increases debit", () => {
  const rule = { fixedUsdt: 1, percentage: 2 };

  assert.deepEqual(calculateCryptoPayout(100, rule, "recipient"), {
    enteredAmount: "100.00",
    ashtechFee: "3.00",
    payoutAmount: "97.00",
    totalDebit: "100.00",
  });
  assert.deepEqual(calculateCryptoPayout(100, rule, "sender"), {
    enteredAmount: "100.00",
    ashtechFee: "3.00",
    payoutAmount: "100.00",
    totalDebit: "103.00",
  });
});

test("payout calculation accepts ordinary two-decimal values and rejects excess precision", () => {
  assert.equal(calculateCryptoPayout(0.29, { fixedUsdt: 0, percentage: 0 }, "sender").payoutAmount, "0.29");
  assert.throws(
    () => calculateCryptoPayout(1.001, { fixedUsdt: 0, percentage: 0 }, "sender"),
    /INVALID_CRYPTO_PAYOUT_AMOUNT/,
  );
  assert.throws(
    () => calculateCryptoPayout(1, { fixedUsdt: 2, percentage: 0 }, "recipient"),
    /CRYPTO_PAYOUT_FEE_EXCEEDS_AMOUNT/,
  );
});

test("only explicit invalid payout requests are eligible for immediate refund", () => {
  assert.equal(isDefinitiveIziPayoutRejection({ status: 400, code: "INVALID_ADDRESS" }), true);
  assert.equal(isDefinitiveIziPayoutRejection({ status: 422, code: "MEMO_REQUIRED" }), true);
  assert.equal(isDefinitiveIziPayoutRejection({ status: 503, code: "INVALID_ADDRESS" }), false);
  assert.equal(isDefinitiveIziPayoutRejection({ status: 400, code: "INSUFFICIENT_BALANCE" }), false);
});

test("IziChange payout response normalizes the documented data.object envelope", () => {
  assert.deepEqual(normalizeIziPayoutResponse({
    data: {
      object: {
        id: "payout-123",
        status: "confirmed",
        assetCode: "USDT.TRC20",
        amount: "97.00",
        feeAmount: "1.20",
        merchantReference: "withdrawal-123",
      },
    },
  }), {
    id: "payout-123",
    status: "confirmed",
    assetCode: "USDT.TRC20",
    amount: "97.00",
    feeAmount: "1.20",
    merchantReference: "withdrawal-123",
  });
});

test("IziChange payout API selects the documented test and live hosts", () => {
  assert.equal(getIziPayPayoutBaseUrlForMode("test"), "https://api.sandbox-pay.izichange.com");
  assert.equal(getIziPayPayoutBaseUrlForMode("live"), "https://api.izichangepay.com");
});