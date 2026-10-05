---
name: Country wallet currency codes
description: Country and destination mappings must preserve distinct internal wallet codes such as XAFG and XAFC.
---

The `countries` table (used by `storage.getActiveCountries()` → `/api/transfers/config` and similar endpoints) stores a plain `currency` column per country. Frontend features that auto-select a wallet by destination country read this value directly, and withdrawal routing uses the shared destination-country currency mapping.

AshTech Pay uses distinct per-country wallet codes for countries sharing the CFA franc; country ISO currencies and internal wallet codes are not interchangeable. The current mapping is defined in `CURRENCY_ZONE`.

**Why:** Collapsing CFA countries to generic XAF/XOF makes wallet selection and withdrawal debit the wrong balance. The Gabon withdrawal flow was checking XAF while the user's funds were in XAFG.

**How to apply:** Whenever debugging a currency/wallet-selection mismatch, check `CURRENCY_ZONE` and the country record before assuming the provider is at fault. Keep the UI wallet display, withdrawal debit/refund logic, and transaction currency aligned; use the generic ISO code only when calling the external provider.

Country-specific deposit and withdrawal limits use the same internal wallet currency as the destination. For public payment links, validate the explicitly submitted display currency first, then convert to that country wallet before comparing the limit.

**Why:** A country's database ISO field can be shared by multiple country-specific wallets, while the payment page submits the selected internal wallet code.

**How to apply:** Keep limit comparisons in the destination wallet's units and never infer the payment-link input currency from the database ISO field when the request includes an explicit currency.
