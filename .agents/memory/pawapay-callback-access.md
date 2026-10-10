---
name: PawaPay callback access
description: PawaPay callback authentication expectations and safe fallback controls
---

PawaPay callback settlement must require proof of provider origin even though the HTTP endpoint is public. Configure the shared callback token in the provider callback URL/proxy before enabling delivery; missing configuration must fail closed. Never restore the old optional-authentication behavior.

**Why:** The initiating payer can read the deposit UUID and forge a completed callback. UUID validation and idempotency do not prevent the first fraudulent wallet credit. Rejecting an unconfigured callback is safer than accepting unverified payment status.

**How to apply:** Keep callback routes outside user authentication, but require provider authentication before lookup or mutation. Do not treat the unimplemented signature verifier as working authentication. Keep retired PawaPay out of admin provider selection.