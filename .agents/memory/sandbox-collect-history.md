---
name: Sandbox collection history
description: Invariants for fake-number tests accepted through Direct API collection.
---

Accepted sandbox `/v1/collect` scenarios create an informational `sandbox_test` history row. The record must never credit or debit a wallet, send a merchant webhook, call a provider, or be administratively settled. Any credited or fee amounts returned by the simulation are illustrative only.

**Why:** the user asked for test attempts to remain visible while never crediting the account.

**How to apply:** preserve the dedicated test type/status in transaction history, API reads, admin status changes, and reconstructed wallet balances.
