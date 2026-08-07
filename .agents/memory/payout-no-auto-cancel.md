---
name: Payout no auto-cancel policy
description: Withdrawals/transfers must never be auto-failed+refunded on timeouts or ambiguous errors
---

# Payouts (retraits & transferts) : jamais d'annulation automatique

Rule: a payout (withdrawal / transfer_out) that has been debited must NEVER be
marked `failed` + refunded except on an **explicit, definitive** provider
rejection (invalid phone/number, unsupported operator, blacklist) or an
explicit provider status `failed/refunded/cancelled`.

Everything else — network errors, timeouts, 5xx, rate limits, ambiguous
messages, poll-attempt limits, provider auth outage — must go to
`pending_manual` (no refund) or simply stay `pending`.

**Why:** transient initiation errors and a 60-min poll timeout were
auto-failing + refunding payouts while the provider still said PENDING —
risking double payout (money sent + refunded) and user-visible "cancels on
its own" behavior.

**How to apply:** any new payout path or poller must default to
pending/pending_manual on uncertainty; refunds only on definitive rejection.
Applies in the payout initiation branches, the payment poller recovery, and
the payout poller timeout handling.
