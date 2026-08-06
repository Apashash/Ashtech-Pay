---
name: AfribaPay country operator catalog
description: Active operator choices and provider-code rules for the published AfribaPay country catalogue.
---

The official published AfribaPay `/v1/countries` example confirms these active catalogues: BF=`moov`, `orange`, `wligdicash`; BJ=`moov`, `mtn`, `celtiis`, `coris`; CD=`airtel`, `mpesa`, `orange`, `afrimoney`, `vodacom`; CI=`moov`, `mtn`, `orange`, `wave`; CM=`mtn`, `orange`; GA=`airtel`, `moov`; ML=`moov`, `orange`; NE=`airtel`; SN=`expresso`, `free`, `orange`, `wave`; TG=`moov`, `tmoney`.

**Why:** AfribaPay availability is not the same across countries. A generic operator list caused valid operators to be missing and unconfirmed choices to be shown in deposit, withdrawal, and transfer screens. The live catalogue could not be queried while the configured subscription was inactive, so the official published collection is the current verification source.

**How to apply:** Keep the database `operators` rows, `/api/transfers/config` filters, public deposit/withdrawal config, test-payment page, PDF, and static developer documentation aligned. Use the exact codes above. Country-level active fees may serve as the fallback for operator rows.

## Direct API verification — 2026-08-06

`POST https://api.afribapay.com/v1/token` and `GET https://api.afribapay.com/v1/countries` both returned HTTP 200 with the configured account. The live response contained 16 countries and differs from the older published example:

- BF: `moov`, `orange`, `wligdicash`
- CD: `airtel`, `mpesa`, `orange`, `afrimoney`, `vodacom`
- CF: `orange`
- CG: `airtel`, `mtn`
- CI: `moov`, `mtn`, `orange`, `wave`, `djamo`
- CM: `mtn`, `orange`
- GA: `airtel`, `moov`
- GN: `mtn`, `orange`
- GW: `orange`
- ML: `moov`, `orange`
- NE: `airtel`, `wligdicash`, `moov`, `amanata`, `nita`, `zamani`
- SN: `emoney`, `free`, `orange`, `wave`
- TG: `moov`, `tmoney`
- BJ: `moov`, `mtn`, `celtiis`, `coris`
- TD: `airtel`, `moov`
- GM: `afrimoney`

The API response reported provider currencies `CDF` for CD, `GNF` for GN, `GMD` for GM, `XOF` for West African CFA countries, and `XAF` for Central African CFA countries. This is provider data; internal country-specific wallet codes remain separate.

**Why:** The live account catalogue is now verifiable and is broader than the static catalogue previously used while the subscription was inactive. The application should not be changed to activate these additional countries/operators until the product decision and fee/wallet configuration are confirmed.

**How to apply:** For future support replies, report the live 200 response as the authoritative current provider result. Before enabling a newly returned country/operator in customer flows, reconcile it with supported-country policy, internal wallets, fees, OTP behavior, and historical-data rules.