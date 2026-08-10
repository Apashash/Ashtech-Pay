---
name: Merchant webhook delivery
description: Durable rules for merchant webhook queuing, signing, retries, and multi-worker delivery.
---

Merchant webhook events must be enqueued in PostgreSQL with a unique `(transaction_id, event)` key before delivery. Provider callbacks, payment pollers, and hosted payment flows must share the same enqueue/delivery implementation rather than sending direct HTTP requests.

**Why:** Multiple workers and overlapping provider/poller callbacks can otherwise double-send unsigned events or lose notifications after a process restart.

**How to apply:** Claim rows atomically with a persisted delivery status, sign `timestamp.body` with the encrypted merchant secret, retry transient failures with a bounded backoff, and mark exhausted deliveries permanently failed. Missing field encryption configuration must fail closed and remain retryable.