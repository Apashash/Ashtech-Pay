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
messages, provider auth outage — must go to `pending_manual` (no refund) or
simply stay `pending`.

User requirement (2026-08-07): payout polling is **infinite** — no attempt
cap at all. While the provider says PENDING, keep the transaction pending and
keep checking forever; after 30 min the poll cadence slows to every 2 min to
protect provider API quotas. Never reintroduce a max-attempts bailout.

**Why:** transient initiation errors and a 60-min poll timeout were
auto-failing + refunding payouts while the provider still said PENDING —
risking double payout (money sent + refunded) and user-visible "cancels on
its own" behavior.

**How to apply:** any new payout path or poller must default to
pending/pending_manual on uncertainty; refunds only on definitive rejection.
Applies in the payout initiation branches, the payment poller recovery, and
the payout poller timeout handling.
