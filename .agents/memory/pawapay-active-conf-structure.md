---
name: PawaPay active-conf structure
description: Documented PawaPay v2 active configuration shape used for provider validation
---

PawaPay v2 `active-conf` groups providers by country. Each provider exposes `currencies`, and each currency contains an `operationTypes` object whose keys include `DEPOSIT`, `PAYOUT`, or `REFUND`; operation types are not necessarily a flat provider-level array.

**Why:** Filtering only a flat `provider.operationTypes` array removes valid providers such as `MTN_MOMO_CMR` before a deposit is initiated, producing a false “provider not active” error.

**How to apply:** When validating a provider, inspect the operation-type keys under every configured currency and keep the provider only when the requested operation is present. Preserve country/provider identifiers from the documented response.