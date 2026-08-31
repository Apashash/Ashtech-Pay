---
name: PawaPay SMS branding
description: Distinction between PawaPay payload fields and the Mobile Money SMS sender label
---

PawaPay's `provider` field must remain the technical MMO code such as `MTN_MOMO_CMR`. Its `customerMessage` field accepts the merchant's 4–22 character transaction note, while the sender/header shown by MTN (for example an aggregator or merchant account name) is controlled outside the initiation payload by PawaPay/MTN configuration.

**Why:** Replacing `provider` with the app name would break routing; setting only `customerMessage` cannot change the telecom's sender identity.

**How to apply:** Send the AshTechPay brand as `customerMessage` when desired, and request sender-name/account branding changes through the PawaPay/MTN merchant configuration.