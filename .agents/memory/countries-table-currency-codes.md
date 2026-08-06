---
name: Country wallet currency codes
description: Country and destination mappings must preserve distinct internal wallet codes such as XAFG and XAFC.
---

The `countries` table (used by `storage.getActiveCountries()` → `/api/transfers/config` and similar endpoints) stores a plain `currency` column per country. Frontend features that auto-select a wallet by destination country read this value directly, and withdrawal routing uses the shared destination-country currency mapping.

AshTech Pay uses distinct per-country wallet codes for several countries sharing the CFA franc, not only the generic ISO code: GA→XAFG, CG→XAFC, SN→XOFS, TG→XOFT, BJ→XOFB, BF→XOFF, CI→XOFC (while CM/CF/GQ/TD stay plain XAF, and ML/NE/GW stay plain XOF).

**Why:** Collapsing CFA countries to generic XAF/XOF makes wallet selection and withdrawal debit the wrong balance. The Gabon withdrawal flow was checking XAF while the user's funds were in XAFG.

**How to apply:** Whenever debugging a currency/wallet-selection mismatch, check both the country's `currency` value and the shared destination mapping before assuming the provider is at fault. Keep the UI wallet display, withdrawal debit/refund logic, and transaction currency aligned; use the generic ISO code only when calling the external provider.
