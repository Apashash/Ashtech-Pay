---
name: AfribaPay status verification
description: How to query AfribaPay pay-in status by provider and AshTech references.
---

For AfribaPay deposits and payment links, check a distinct provider `transaction_id` normally. Query the AshTech `order_id` only as a fallback after the transaction has remained pending for at least 24 hours. If the provider transaction lookup has already returned a terminal status, do not query the AshTech order ID.

**Why:** The user's requested status flow prioritizes AfribaPay's own transaction reference and uses the AshTech-generated order ID only for transactions that remain pending for a full day.

**How to apply:** Keep the existing provider polling cadence and slow-poll behavior. Do not fail or cancel a transaction merely because 24 hours elapsed; the order ID lookup is a fallback check, not an expiry rule. Keep public/client-facing references AshTech-generated.