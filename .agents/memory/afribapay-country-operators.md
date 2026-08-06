---
name: AfribaPay country operator catalog
description: Active operator choices and provider-code rules for BJ, CI, and NE payment flows.
---

The official published AfribaPay `/v1/countries` example confirms: Benin has `moov`, `mtn`, `celtiis`, and `coris`; Côte d’Ivoire has `moov`, `mtn`, `orange`, and `wave`; Niger has `airtel` only. Djamo, Amanata, Nita, Zamani, and Niger Orange/Moov are not confirmed by that catalogue and must stay inactive for new flows while historical transaction records remain untouched.

**Why:** AfribaPay availability is not the same across countries. A generic operator list caused valid operators to be missing and unconfirmed choices to be shown in deposit, withdrawal, and transfer screens. The live catalogue could not be queried while the configured subscription was inactive, so the official published collection is the current verification source.

**How to apply:** Keep the database `operators` rows, `/api/transfers/config` filters, public deposit/withdrawal config, and static developer documentation aligned. Use the confirmed AfribaPay codes `celtiis`, `coris`, `airtel`, `moov`, `mtn`, `orange`, and `wave`. Country-level active fees may serve as the fallback for operator rows.