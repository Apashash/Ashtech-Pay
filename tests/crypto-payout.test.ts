import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCryptoPayout,
  getIziPayoutIdForPolling,
  isDefinitiveIziPayoutRejection,
  parseCryptoPayoutFeeConfig,
  parseCryptoWithdrawalLimits,
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

test("crypto withdrawal limits require positive, ordered USDT amounts with at most two decimals", () => {
  assert.deepEqual(parseCryptoWithdrawalLimits('{"minUsdt":"5.25","maxUsdt":"500"}'), {
    minUsdt: 5.25,
    maxUsdt: 500,
    configured: true,
  });
  assert.equal(parseCryptoWithdrawalLimits({ minUsdt: 0.29, maxUsdt: 10 }).configured, true);
  assert.deepEqual(parseCryptoWithdrawalLimits('{"minUsdt":null,"maxUsdt":500}'), {
    minUsdt: null,
    maxUsdt: null,
    configured: false,
  });
  assert.equal(parseCryptoWithdrawalLimits({ minUsdt: 50, maxUsdt: 20 }).configured, false);
  assert.equal(parseCryptoWithdrawalLimits({ minUsdt: 0, maxUsdt: 20 }).configured, false);
  assert.equal(parseCryptoWithdrawalLimits({ minUsdt: 1.001, maxUsdt: 20 }).configured, false);
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
  assert.equal(isDefinitiveIziPayoutRejection({ status: 400, code: "ASSET_DISABLED_PLATFORM" }), true);
  assert.equal(isDefinitiveIziPayoutRejection({ status: 400, code: "ASSET_DISABLED_MERCHANT" }), true);
  assert.equal(isDefinitiveIziPayoutRejection({ status: 503, code: "INVALID_ADDRESS" }), false);
  assert.equal(isDefinitiveIziPayoutRejection({ status: 400, code: "INSUFFICIENT_BALANCE" }), false);
  assert.equal(isDefinitiveIziPayoutRejection(new TypeError("fetch failed")), false);
  assert.equal(isDefinitiveIziPayoutRejection({ status: 503, code: "UPSTREAM_ERROR" }), false);
});

test("IziChange payout polling requires a provider ID, never just an old retry flag", () => {
  assert.equal(getIziPayoutIdForPolling(undefined, {
    iziRetrySafe: true,
    iziPayoutRequest: { assetCode: "USDT.TRC20", amount: "2.00" },
  }), undefined);
  assert.equal(getIziPayoutIdForPolling(" payout-external-1 ", {}), "payout-external-1");
  assert.equal(getIziPayoutIdForPolling(undefined, { iziPayoutId: " payout-external-2 " }), "payout-external-2");
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
  assert.equal(getIziPayPayoutBaseUrlForMode("live"), "https://api.pay.izichange.com");
});