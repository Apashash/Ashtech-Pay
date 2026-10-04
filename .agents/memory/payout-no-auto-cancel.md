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

Keep a persisted provider attempt ID immutable while its request may have been
accepted or its outcome is ambiguous; never poll a different provider or replace
that attempt in those cases. A new same-provider attempt is allowed only after
an explicit provider response proves the previous request was rejected without
creating a payout, such as a documented insufficient-balance response.

User requirement (2026-10-04): admins may manually change a pending payout's
status even when the provider has not replied or an external reference exists.
Manual completion must not submit another payout. Manual failure/cancellation
must immediately refund the original wallet, even though a late provider payout
could cause a double payment. Keep the provider reference in the audit record.

User requirement (2026-10-04): payout initiation uses the provider configured
for that payout. An explicit insufficient provider balance stays pending_manual
without refund; after the admin replenishes that provider, the admin can resubmit
through the same provider. A definitive provider confirmation then updates the
transaction automatically. The manual "confirm" action is separate and does not
call the provider.

**Why:** the user specified this as the intended workflow for payouts across
configured providers.

**How to apply:** preserve the configured provider on the pending transaction,
allow a same-provider retry after an explicit no-payout balance rejection, and
settle through provider callback/polling rather than treating an admin status
override as a provider execution.

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

**How to apply:** automatic payout paths and pollers must classify only explicit,
confirmed terminal transaction statuses as failed+refunded. HTTP 404, `NOT_FOUND`,
generic `ERROR`, timeouts, and ambiguous responses remain pending/pending_manual
unless provider documentation confirms that exact response is terminal. Persist
the provider ID before submission, reuse it for every reconciliation, block
the provider ID for reconciliation, and settle status plus wallet mutation
atomically. For an admin-requested terminal override, do not resubmit; process
failure refunds against the original wallet and log the retained provider ID.

**Why:** the user explicitly chose immediate refunds for admin-forced payout
failures after being told a late provider payment could result in a double
payment. This is an intentional admin-only exception to the automatic
no-refund-on-ambiguous-result rule.

Administrative reopening of a rejected withdrawal or transfer must also debit
the previously refunded total from the original wallet in the same database
transaction as the `failed/cancelled` → `pending` transition. If the wallet
cannot cover it, leave the transaction rejected and report the insufficiency.
