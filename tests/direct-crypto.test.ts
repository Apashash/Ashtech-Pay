import test from "node:test";
import assert from "node:assert/strict";
import {
  computeDirectCryptoAmounts,
  MIN_DIRECT_CRYPTO_USDT,
  parseDirectCryptoRequest,
} from "../server/directCrypto";
import { filterCryptoAssets, getStaticCryptoAssets, parseDisabledCryptoAssets } from "../server/cryptoAssets";
import { cryptoQrPayload } from "../client/src/lib/crypto-qr";

test("sandbox request accepts USDT and asset_code", () => {
  const result = parseDirectCryptoRequest({
    amount: "25",
    currency: "usdt",
    asset_code: "USDT.TRC20",
    reference: "ORDER-CRYPTO-001",
    notify_url: "https://merchant.example/webhook",
    customer: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, {
      amount: 25,
      currency: "USDT",
      assetCode: "USDT.TRC20",
      reference: "ORDER-CRYPTO-001",
      notifyUrl: "https://merchant.example/webhook",
      refundAddress: null,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    });
  }
});

test("sandbox request supports fiat currencies and camelCase aliases", () => {
  const result = parseDirectCryptoRequest({
    amount: 10000,
    currency: "xaf",
    assetCode: "BTC",
    refundAddress: "bc1-refund-address",
    first_name: "Test",
    last_name: "Merchant",
    email: "test@example.com",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.currency, "XAF");
    assert.equal(result.value.assetCode, "BTC");
    assert.equal(result.value.refundAddress, "bc1-refund-address");
  }
});

test("sandbox validation rejects missing fields, invalid amount, and invalid currency", () => {
  assert.equal(parseDirectCryptoRequest({ currency: "USDT", asset_code: "BTC" }).error, "invalid_amount");
  assert.equal(parseDirectCryptoRequest({ amount: 1, currency: "USDT" }).error, "missing_fields");
  assert.equal(parseDirectCryptoRequest({ amount: 1, currency: "EUR", asset_code: "BTC" }).error, "invalid_currency");
});

test("sandbox fee calculation returns gross, fee, and credited amounts", () => {
  assert.deepEqual(computeDirectCryptoAmounts(100, 2.5), {
    grossUsdt: 100,
    feeUsdt: 2.5,
    creditedUsdt: 97.5,
    feePercent: 2.5,
  });
  assert.deepEqual(computeDirectCryptoAmounts(12.3456789, 3), {
    grossUsdt: 12.345679,
    feeUsdt: 0.37037,
    creditedUsdt: 11.975309,
    feePercent: 3,
  });
});

test("sandbox crypto Pay-In minimum is one gross USDT", () => {
  assert.equal(MIN_DIRECT_CRYPTO_USDT, 1);
  assert.ok(computeDirectCryptoAmounts(MIN_DIRECT_CRYPTO_USDT, 2.5).creditedUsdt < 1);
});

test("sandbox asset catalogue filters disabled networks without removing other networks", () => {
  const assets = getStaticCryptoAssets();
  const disabled = parseDisabledCryptoAssets(JSON.stringify(["USDT.TRC20", "BTC"]));
  const filtered = filterCryptoAssets(assets, disabled);

  assert.equal(filtered.USDT.networks.some(network => network.assetCode === "USDT.TRC20"), false);
  assert.equal(filtered.USDT.networks.some(network => network.assetCode === "USDT.BEP20"), true);
  assert.equal(filtered.BTC, undefined);
});

test("sandbox fallback identifies memo/tag networks", () => {
  const assets = getStaticCryptoAssets();
  assert.equal(assets.XRP.networks[0].memoRequired, true);
  assert.equal(assets.XRP.networks[0].memoType, "tag");
  assert.equal(assets.TON.networks[0].memoRequired, true);
  assert.equal(assets.TON.networks[0].memoType, "memo");
});

test("sandbox QR payload uses one data value and preserves memo separately", () => {
  assert.equal(
    cryptoQrPayload("XRP", "rAddress", "12345", "tag"),
    "xrpl:rAddress?dt=12345",
  );
  assert.equal(
    cryptoQrPayload("USDT.TRC20", "TAddress", "memo-1", "memo"),
    "TAddress",
  );
});