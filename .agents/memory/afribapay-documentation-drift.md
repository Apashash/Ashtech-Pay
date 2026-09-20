---
name: AfribaPay documentation drift
description: Durable handling for conflicting AfribaPay callback-signature and PAYIN-limit documentation.
---

AfribaPay’s public documentation has described more than one HMAC input format for `AfribaPAY-Sign` and has published different PAYIN maximums. Until the provider confirms one contract, accept only HMACs computed with the server-side credential over the raw body or the documented timestamp-prefixed variants, and enforce the lower 2,000,000 ceiling.

**Why:** Choosing the higher limit or one signature example alone can either send requests the provider rejects or reject valid provider callbacks.

**How to apply:** Revisit this decision when AfribaPay supplies a definitive production callback example and account-specific PAYIN limits; then narrow the accepted signature format and update the validation tests together.