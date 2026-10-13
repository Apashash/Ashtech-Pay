---
name: AfribaPay documentation drift
description: Current AfribaPay signature contract and documentation conflicts with live OTP data and admin-configured limits.
---

The current public Postman collection specifies HMAC-SHA256 over the exact raw request body in `AfribaPAY-Sign`, using the API key/password, and says missing signatures must be rejected. An unsigned legacy callback-token fallback contradicts that contract. It does not specify timestamp-prefixed input; keep that compatibility only for explicitly timestamped legacy callbacks. The latest OTP table says GN/Orange requires OTP, conflicting with the previously verified live `/v1/countries` response. PAYIN limits are configurable by the admin; the provider's example limits vary by currency/operator, so do not replace admin settings with a global value. Check that any code-level guard does not override the configured range.

**Why:** AfribaPay's latest docs explicitly require signed callbacks and conflict with previously observed OTP data. The user confirmed that PAYIN limits are configured by the admin, so hard-coded sample limits must not silently override those settings.

**How to apply:** Require the documented signature on every callback, verify the untouched raw body in constant time, and reconcile OTP fallback data against the provider's live catalogue. Preserve admin-configured limits and remove/parameterize any conflicting hard-coded guard.