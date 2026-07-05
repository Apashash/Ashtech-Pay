---
name: countries table currency codes must match Swychr per-country codes
description: The `countries` DB table's `currency` column drives wallet auto-selection on frontend pages (e.g. Send Money); it must store Swychr's per-country codes, not generic XAF/XOF.
---

The `countries` table (used by `storage.getActiveCountries()` → `/api/transfers/config` and similar endpoints) stores a plain `currency` column per country. Frontend features that auto-select a wallet by destination country (e.g. send/transfer pages) read this value directly.

Swychr, however, uses distinct per-country currency codes for several countries sharing the CFA franc, not the generic ISO code. The authoritative map lives in `server/swychrPayout.ts` (`COUNTRY_CURRENCY`), e.g. GA→XAFG, CG→XAFC, SN→XOFS, TG→XOFT, BJ→XOFB, BF→XOFF, CI→XOFC (while CM/CF/GQ/TD stay plain XAF, and ML/NE/GW stay plain XOF).

**Why:** The `countries` table had been seeded with the generic XAF/XOF for all CFA countries, causing bugs like Gabon showing/selecting a plain "XAF" wallet instead of "XAFG" on the Send Money page — this was a data problem, not an application logic bug.

**How to apply:** Whenever debugging a currency/wallet-selection mismatch for a specific country, check the `countries` table's `currency` column first and diff it against `COUNTRY_CURRENCY` in `server/swychrPayout.ts` before assuming the frontend/backend logic is wrong. Also note the `countries` table can be missing rows entirely for some codes used elsewhere (e.g. RW/Rwanda, TZ, UG, US were missing as of this fix), which silently skips fee-seeding for those countries.
