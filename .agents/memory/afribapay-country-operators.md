---
name: AfribaPay country operator catalog
description: Active operator choices and provider-code rules for the published AfribaPay country catalogue.
---

The official published AfribaPay `/v1/countries` example confirms these active catalogues: BF=`moov`, `orange`, `wligdicash`; BJ=`moov`, `mtn`, `celtiis`, `coris`; CD=`airtel`, `mpesa`, `orange`, `afrimoney`, `vodacom`; CI=`moov`, `mtn`, `orange`, `wave`; CM=`mtn`, `orange`; GA=`airtel`, `moov`; ML=`moov`, `orange`; NE=`airtel`; SN=`expresso`, `free`, `orange`, `wave`; TG=`moov`, `tmoney`.

**Why:** AfribaPay availability is not the same across countries. A generic operator list caused valid operators to be missing and unconfirmed choices to be shown in deposit, withdrawal, and transfer screens. The live catalogue could not be queried while the configured subscription was inactive, so the official published collection is the current verification source.

**How to apply:** Keep the database `operators` rows, `/api/transfers/config` filters, public deposit/withdrawal config, test-payment page, PDF, and static developer documentation aligned. Use the exact codes above. Country-level active fees may serve as the fallback for operator rows.