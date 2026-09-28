---
name: AfribaPay status verification
description: How to query AfribaPay pay-in status by provider and AshTech references.
---

For AfribaPay deposits and payment links, query the provider's `transaction_id` when a distinct AfribaPay ID is saved, and also retain the AshTech `order_id` check. A pending result from either lookup does not override a definitive result from the other; conflicting completed/failed results must remain pending.

**Why:** AfribaPay identifies accepted payments with its provider transaction ID, while the AshTech-generated order ID remains the initiation reference and compatibility path. Neither identifier should silently replace the other.

**How to apply:** Use the 30-second provider polling cadence, skip the second lookup when both identifiers are the same, and keep public/client-facing references AshTech-generated.