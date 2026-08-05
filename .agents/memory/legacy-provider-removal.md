---
name: Legacy provider removal
description: Durable rules for removing a payment provider without retrying or refunding historical transactions.
---

When a payment provider is removed, normalize its operator configuration to a
supported provider and mark any still-pending transactions that depended on it
as failed. Do not retry, credit, debit, or refund those records automatically.
Record the cleanup in the user's notifications and the system audit log, and
make the migration idempotent with a persistent marker.

**Why:** Historical provider rows can otherwise be picked up by deposit or
payout pollers and silently submitted to a removed service; automatic refunds
could also create an unapproved financial movement.

**How to apply:** Keep legacy-value handling isolated to a one-time cleanup
path. Remove leftover physical columns through the reviewed schema publication
flow, not an unconditional startup DDL migration against production.