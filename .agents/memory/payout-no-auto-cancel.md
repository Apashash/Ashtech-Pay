---
name: Payout no auto-cancel policy
description: Withdrawals/transfers must never be auto-failed+refunded on timeouts or ambiguous errors
---

# Payouts (retraits & transferts) : jamais d'annulation automatique

Rule: a payout (withdrawal / transfer_out) that has been debited must go to
`pending_manual` for provider liquidity shortages, authentication errors,
timeouts, 5xx, rate limits, and ambiguous messages. Definitive provider
rejections (invalid number, unsupported operation/operator, or terminal
`failed/refunded/cancelled`, or an explicit provider `NOT_FOUND`/HTTP 404)
must be marked rejected and the debit reversed.

Only a successful provider initiation/status may continue through automatic
polling and settlement. An internal wallet balance check that fails before a
transaction is created remains an immediate user-facing rejection.

Once a provider attempt ID has been persisted, that ID is immutable until the
provider returns a definitive terminal status. Admin actions, Telegram actions,
restarts, and manual retries must reconcile the same attempt; they must never
switch providers, generate a replacement ID, force-complete, or refund an
unresolved attempt.

For providers whose callback and poller can race, the terminal transaction
claim and corresponding wallet credit/refund must commit in one database
transaction.

User requirement (2026-08-07): payout polling is **infinite** — no attempt
cap at all. While the provider says PENDING, keep the transaction pending and
keep checking forever; after 30 min the poll cadence slows to every 2 min to
protect provider API quotas. Never reintroduce a max-attempts bailout.

**Why:** transient initiation errors and a 60-min poll timeout were
auto-failing + refunding payouts while the provider still said PENDING —
risking double payout (money sent + refunded) and user-visible "cancels on
its own" behavior. An explicit provider NOT_FOUND/404 is different: the
provider has stated that the submitted payment does not exist, so leaving it
reserved forever is incorrect. Replacing an ambiguous provider ID or
committing status separately from wallet mutation creates the same double-spend
risk under timeouts, callbacks, admin actions, and process crashes.

**How to apply:** any new payout path or poller must classify explicit terminal
rejections, including NOT_FOUND/404, as failed+refunded; all other provider
errors default to pending/pending_manual. Persist the provider ID before
submission, reuse it for every reconciliation, block manual terminal changes
while unresolved, and settle status plus wallet mutation atomically.

Administrative reopening of a rejected withdrawal or transfer must also debit
the previously refunded total from the original wallet in the same database
transaction as the `failed/cancelled` → `pending` transition. If the wallet
cannot cover it, leave the transaction rejected and report the insufficiency.
