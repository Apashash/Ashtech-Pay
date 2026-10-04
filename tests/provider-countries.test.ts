import assert from "node:assert/strict";
import test from "node:test";
import {
  getAvailablePayoutProviders,
  getPayoutProviderCountryCodes,
  isProviderAvailable,
} from "../shared/provider-countries.ts";

test("provider availability is country-specific and case-insensitive", () => {
  assert.deepEqual(getAvailablePayoutProviders("cm"), ["afribapay", "pixpay", "pawapay"]);
  assert.deepEqual(getAvailablePayoutProviders("ET"), ["pawapay"]);
  assert.equal(isProviderAvailable("pixpay", "BF"), true);
  assert.equal(isProviderAvailable("pixpay", "GH"), false);
});

test("provider coverage lists countries for the fee configuration screen", () => {
  assert.ok(getPayoutProviderCountryCodes("afribapay").includes("GN"));
  assert.ok(getPayoutProviderCountryCodes("pawapay").includes("ZM"));
});