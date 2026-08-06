---
name: AfribaPay country operator catalog
description: Active operator choices and provider-code rules for BJ, CI, and NE payment flows.
---

The supported operator catalog is country-specific: Benin includes Celtiis, Coris Money, MTN Mobile Money, and Moov Money; Côte d’Ivoire includes Djamo, Moov Money, MTN Mobile Money, Orange Money, and Wave; Niger includes Airtel Money, Amanata, Moov Money, Nita, and Zamani. Niger Orange Money and any other removed operator must stay inactive for new flows while historical transaction records remain untouched.

**Why:** AfribaPay availability is not the same across countries. A generic operator list caused valid operators to be missing and invalid Niger choices to be shown in deposit, withdrawal, and transfer screens.

**How to apply:** Keep the database `operators` rows, `/api/transfers/config` filters, public deposit/withdrawal config, and static developer documentation aligned. Use the exact AfribaPay codes `celtiis`, `coris`, `djamo`, `airtel`, `amanata`, `moov`, `nita`, and `zamani`. Country-level active fees may serve as the fallback for newly added operator rows.