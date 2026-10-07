---
name: AfribaPay status verification
description: AfribaPay pay-in and payout status lookups, callback fields, and API hosts.
---

For AfribaPay deposits and payment links, prefer the provider callback for timely state changes and use status polling only as reconciliation. Each status request must query exactly one identifier. Prefer a confirmed provider `transaction_id`; query an AshTech `order_id` only when AfribaPay confirms that the order exists in its system and has an associated PIM or POM. A 24-hour delay alone does not make an order ID safe to query. Never query a second identifier after a terminal result.

For payouts, the public Postman collection documents `GET /v1/status` on the shared API host (`api-sandbox.afribapay.com` in the collection; production uses `api.afribapay.com`). Payout initiation uses a separate `api-payout` host; do not assume its host also serves status lookups. Query an `order_id` only when AfribaPay confirms that the provider record exists with an attached PIM or POM; an omitted provider order ID is not permission to substitute the submitted AshTech ID.

The same collection says AfribaPay POSTs to `notify_url` on status updates. Its callback example uses top-level `order_id`, `reference_id`, `transaction_id`, and `status`; terminal values are `SUCCESS` and `FAILED`, while `PENDING` is non-final. The `AfribaPAY-Sign` header is HMAC-SHA256 over the exact raw JSON body, keyed with the API key/password.

**Why:** AfribaPay advised that status lookups for unknown transactions overload its servers and that an order-ID lookup is valid only for an existing provider transaction with an attached PIM or POM. Callbacks and bounded polling are complementary; callbacks must be verified against the exact bytes AfribaPay signed.

**How to apply:** Use the public HTTPS `notify_url` callback as the primary way to apply completed/rejected outcomes, idempotently and after signature verification. Keep bounded polling only for transactions with a provider-confirmed lookup identifier; do not use age alone to trigger order-ID lookups, and do not fail or cancel a payment because a callback or lookup is delayed. For payouts, use the shared status API host and only a confirmed order ID.