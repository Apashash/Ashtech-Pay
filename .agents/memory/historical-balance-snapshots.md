---
name: Historical balance snapshots
description: Limits of reconstructing before/after wallet balances from current balances and transaction statuses.
---

Do not treat reverse-reconstructed transaction balances as authoritative audit history. A failed payout may have debited one wallet and refunded another; status-only reconstruction assumes the failed transaction had no net effect in its currency and can display unchanged balances or impossible negative historical balances.

**Why:** Current balances plus transaction rows do not encode every wallet mutation when refund routing is wrong or an old transaction lacks its original wallet movement. The derived view can therefore contradict both the actual payout flow and present wallet balances.

**How to apply:** Use persisted per-wallet before/after snapshots or a balance ledger for authoritative history. Until then, label reconstructed values as estimates, and reconcile terminal payout/refund mutations against the exact wallet currency before presenting them as facts.
