import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDirectCryptoCustomer,
  computeDirectCryptoAmounts,
  MIN_DIRECT_CRYPTO_USDT,
  parseDirectCryptoRequest,
} from "../server/directCrypto";
import { normalizeDirectChargeResponse } from "../server/izichange";
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

test("sandbox customer email is optional and omitted from the upstream customer object", () => {
  const parsed = parseDirectCryptoRequest({
    amount: 1,
    currency: "USDT",
    asset_code: "USDT.TRC20",
    first_name: "J",
    last_name: "S",
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.email, undefined);
    assert.deepEqual(buildDirectCryptoCustomer(parsed.value), undefined);
  }

  const withEmail = parseDirectCryptoRequest({
    amount: 1,
    currency: "USDT",
    asset_code: "USDT.TRC20",
    first_name: "Ada",
    last_name: "Lovelace",
    email: "ada@example.com",
  });
  assert.equal(withEmail.ok, true);
  if (withEmail.ok) {
    assert.deepEqual(buildDirectCryptoCustomer(withEmail.value), {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      refundAddress: undefined,
    });
  }
});

test("sandbox validation rejects missing fields, invalid amount, and invalid currency", () => {
  assert.equal(parseDirectCryptoRequest({ currency: "USDT", asset_code: "BTC" }).error, "invalid_amount");
  assert.equal(parseDirectCryptoRequest({ amount: 1, currency: "USDT" }).error, "missing_fields");
  assert.equal(parseDirectCryptoRequest({ amount: 1, currency: "EUR", asset_code: "BTC" }).error, "invalid_currency");
  assert.equal(parseDirectCryptoRequest({
    amount: 1,
    currency: "USDT",
    asset_code: "BTC",
    customer: { email: "not-an-email" },
  }).error, "invalid_email");
  assert.equal(parseDirectCryptoRequest({
    amount: 1,
    currency: "USDT",
    asset_code: "BTC",
    notify_url: "http://merchant.example/webhook",
  }).error, "invalid_notify_url");
});

test("sandbox fee calculation returns gross, fee, and credited amounts", () => {
  assert.deepEqual(computeDirectCryptoAmounts(100, 2.5), {
    grossUsdt: 100,
    feeUsdt: 2.5,
    creditedUsdt: 97.5,
    feePercent: 2.5,
    providerFeePercent: 0,
    providerFeeUsdt: 0,
    ashtechFeePercent: 2.5,
    ashtechFeeUsdt: 2.5,
    totalFeePercent: 2.5,
  });
  assert.deepEqual(computeDirectCryptoAmounts(12.3456789, 3), {
    grossUsdt: 12.345679,
    feeUsdt: 0.37037,
    creditedUsdt: 11.975309,
    feePercent: 3,
    providerFeePercent: 0,
    providerFeeUsdt: 0,
    ashtechFeePercent: 3,
    ashtechFeeUsdt: 0.37037,
    totalFeePercent: 3,
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

test("provider direct charge response accepts flat and nested address shapes", () => {
  const flat = normalizeDirectChargeResponse(
    {
      id: "charge-flat",
      depositAddress: "TFlatAddress",
      memo: null,
      expiresAt: "2026-07-31T19:00:00Z",
    },
    "USDT.TRC20",
    "25.000000",
  );
  assert.equal(flat.address, "TFlatAddress");
  assert.equal(flat.id, "charge-flat");

  const nested = normalizeDirectChargeResponse(
    {
      data: {
        object: {
          id: "charge-nested",
          address: "0xNestedAddress",
          destinationTag: "12345",
          destinationTagType: "tag",
          amountRequested: "25",
        },
      },
    },
    "XRP",
    "25.000000",
  );
  assert.equal(nested.address, "0xNestedAddress");
  assert.equal(nested.memo, "12345");
  assert.equal(nested.memoType, "tag");
  assert.equal(nested.amount, "25");
});

test("provider direct charge response without an address is rejected", () => {
  assert.throws(
    () => normalizeDirectChargeResponse({ id: "missing-address" }, "USDT.TRC20", "25"),
    (error: any) => error?.code === "provider_invalid_response",
  );
});