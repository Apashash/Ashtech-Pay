---
name: AfribaPay status verification
description: AfribaPay pay-in and payout status lookups, callback fields, and API hosts.
---

For AfribaPay deposits and payment links, check a distinct provider `transaction_id` normally. Query the AshTech `order_id` only as a fallback after the transaction has remained pending for at least 24 hours. If the provider transaction lookup has already returned a terminal status, do not query the AshTech order ID.

For payouts, the public Postman collection documents `GET /v1/status?order_id=...` on the shared API host (`api-sandbox.afribapay.com` in the collection; production uses `api.afribapay.com`). Payout initiation uses a separate `api-payout` host; do not assume its host also serves status lookups. Poll the active provider-returned `order_id`, falling back to the submitted order ID only when AfribaPay omits one.

The same collection says AfribaPay POSTs to `notify_url` on status updates. Its callback example uses top-level `order_id`, `reference_id`, `transaction_id`, and `status`; terminal values are `SUCCESS` and `FAILED`, while `PENDING` is non-final. The `AfribaPAY-Sign` header is HMAC-SHA256 over the exact raw JSON body, keyed with the API key/password.

**Why:** Polling and callbacks are complementary; using the payout-initiation host for generic status lookups can fail, and callbacks must be verified against the exact bytes AfribaPay signed.

**How to apply:** Keep the existing provider polling cadence and slow-poll behavior. Do not fail or cancel a pay-in merely because 24 hours elapsed; its order-ID lookup is a fallback check, not an expiry rule. For payouts, use the shared status API host and provider order ID; keep the webhook on the public HTTPS `notify_url` and validate raw-body HMAC before applying terminal outcomes.