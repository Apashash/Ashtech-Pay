---
name: Provider API error exposure
description: Safe rules for returning payment-provider failures through merchant APIs and hosted payment pages.
---

Merchant API and hosted-payment error responses may include the provider's useful message, provider error code, and provider status, but must not expose the provider brand/name or a raw upstream response.

**Why:** Integrators need actionable failure reasons, but upstream payloads can echo credentials, tokens, customer phone numbers, or other personal data; the merchant-facing UI/API should remain provider-neutral.

**How to apply:** Route all new merchant-facing provider failures through the shared safe error-payload builder. Supply request values that could be echoed so they are redacted, and use the documented fallback only when no usable provider message exists. Internal user-facing payment flows may retain their existing cleaned messaging.