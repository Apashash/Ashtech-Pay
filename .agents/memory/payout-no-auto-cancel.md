---
name: Payout no auto-cancel policy
description: Withdrawals/transfers must never be auto-failed+refunded on timeouts or ambiguous errors
---

# Payouts (retraits & transferts) : jamais d'annulation automatique

Rule: a payout (withdrawal / transfer_out) that has been debited must not be
failed or refunded for provider liquidity shortages, authentication errors,
timeouts, 5xx, rate limits, HTTP 404 status lookups, `NOT_FOUND` values, or
generic `ERROR` codes and other ambiguous responses. Keep it pending or route it
to manual review.
Definitive provider rejections and explicit terminal `failed/refunded/cancelled`
statuses may be marked rejected and the debit reversed.

Only a successful provider initiation/status may continue through automatic
polling and settlement. An internal wallet balance check that fails before a
transaction is created remains an immediate user-facing rejection.

Once a provider attempt ID has been persisted, that ID is immutable until the
provider returns a definitive terminal status. Admin actions, Telegram actions,
restarts, and manual retries must reconcile the same attempt; they must never
switch providers, generate a replacement ID, force-complete, or refund an
unresolved attempt.

An admin validation or rejection click for an existing payout attempt should
query that same provider reference and settle only a definitive provider result.
If the provider still reports pending or cannot be reached, keep the payout
open and let the normal poller continue.

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
its own" behavior. AfribaPay's public status-code table labels HTTP 404
"Not Found" as non-final, so it may be an API/lookup error rather than proof
that an already-submitted payout does not exist. Replacing an ambiguous provider
ID or committing status separately from wallet mutation creates the same
double-spend risk under timeouts, callbacks, admin actions, and process crashes.
Generic `ERROR` codes may describe lookup or API failures rather than a terminal
transaction state, so they are not safe refund triggers without provider confirmation.

**How to apply:** any new payout path or poller must classify only explicit,
confirmed terminal transaction statuses as failed+refunded. HTTP 404, `NOT_FOUND`,
generic `ERROR`, timeouts, and ambiguous responses remain pending/pending_manual
unless provider documentation confirms that exact response is terminal. Persist
the provider ID before submission, reuse it for every reconciliation, block
manual terminal changes while unresolved, provide an admin action that checks
the existing attempt rather than force-completing it, and settle status plus
wallet mutation atomically.

Administrative reopening of a rejected withdrawal or transfer must also debit
the previously refunded total from the original wallet in the same database
transaction as the `failed/cancelled` → `pending` transition. If the wallet
cannot cover it, leave the transaction rejected and report the insufficiency.
