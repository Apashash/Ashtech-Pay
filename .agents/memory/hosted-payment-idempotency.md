---
name: Hosted payment idempotency
description: Durable rule for preventing duplicate hosted checkout links when merchants retry order creation.
---

The hosted payment creation endpoint must support a stable merchant-supplied `Idempotency-Key` per order. The first request creates the link; retries return the same link, while the embedded popup only opens an already-created URL.

**Why:** Merchant servers and browsers retry requests, and creating a new payment link on every retry can split one order across duplicate checkout records.

**How to apply:** Keep the key scoped to the merchant, persist it with the hosted payment link, enforce uniqueness at the database boundary, and use a new key only for a genuinely new order or session.