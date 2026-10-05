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

For a confirmed no-payout rejection, retain the rejected provider reference in
the transaction and attempt history. The poller must skip safe-to-retry records;
on the next retry, persist the new reference and clear the retry marker together
before sending the provider request. If a process stops before that point, keep
the transaction available for the same-provider admin retry.

**Why:** deleting the old reference loses audit and callback context, while a
retry marker without a durable transition to the new attempt makes crash
recovery unable to distinguish an unsent retry from an in-flight payout.

**How to apply:** preserve the rejected reference while `payoutRetrySafe` is
true; update the provider reference and set the marker false atomically before
the outbound call, then poll only that new reference if the result is ambiguous.

User requirement (2026-10-04): admins may manually change a pending payout's
status even when the provider has not replied or an external reference exists.
Manual completion must not submit another payout. Manual failure/cancellation
must immediately refund the original wallet, even though a late provider payout
could cause a double payment. Keep the provider reference in the audit record.

User requirement (2026-10-04): payout initiation normally uses the provider
configured for that payout. An explicit insufficient provider balance stays
pending_manual without refund; after the admin replenishes that provider, the
admin can resubmit. A definitive provider confirmation then updates the
transaction automatically. The manual "confirm" action is separate and does not
call the provider.

**Why:** the user specified this as the intended workflow for payouts across
configured providers.

**How to apply:** preserve the configured provider on the pending transaction,
allow retry after an explicit no-payout balance rejection, and settle through
provider callback/polling rather than treating an admin status override as a
provider execution.

User requirement (2026-10-04): an admin may explicitly resubmit an ambiguous
pending Mobile Money payout through AfribaPay, PixPay, or PawaPay when that
provider supports the recipient country. Show the double-payment risk before
confirmation and preserve the prior provider reference and attempt history.
Crypto/IziChange payouts do not use this alternate-provider path.

User display requirement (2026-10-04): keep the payout card concise; show only
the latest reference instead of the repeated retry history, and default the
provider selector to the original provider when it is available while allowing
the admin to change it. Do not show an inline helper sentence beneath the
manual "Confirmer" action.

**Why:** the user accepted this risk after being told an earlier provider attempt
could still complete after a new submission.

**How to apply:** keep automatic retries disabled; require an authenticated
admin action and explicit warning, validate provider-country availability on the
server, and retain prior attempt references in transaction metadata.

For providers whose callback and poller can race, the terminal transaction
claim and corresponding wallet credit/refund must commit in one database
transaction.

User requirement (2026-10-05): payout status polling is **infinite** — no attempt
cap. Check every 3 minutes during the first 10 minutes, then every 30 minutes
without a duration limit. Never reintroduce a max-attempts bailout.

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

When an admin retry changes providers, every subsequent poll must resolve the
active provider and lookup reference from the current persisted attempt, not from
the provider captured in an older in-memory queue entry.

**Why:** a stale queue entry can keep querying the previous provider after a
retry, leaving AshTechPay pending even when the new provider has confirmed.

**How to apply:** read the persisted attempt metadata before each provider lookup
and keep polling unresolved statuses indefinitely; use the user's current
three-minute/ten-minute then thirty-minute cadence.

For AfribaPay payout retries, use the `order_id` returned by the successful
initiation response as the active status-lookup reference. Persist the fresh
submitted retry ID before sending, then replace it with AfribaPay's returned
ID; never query the previous attempt's ID.

**Why:** the provider may assign a new order ID to a retry, and polling the old
attempt can leave the AshTechPay transaction pending after the new payout settles.

**How to apply:** prefer the returned provider `order_id`; if the response omits
it, fall back only to the unique ID submitted for this retry.

**Why:** the user explicitly chose immediate refunds for admin-forced payout
failures after being told a late provider payment could result in a double
payment. This is an intentional admin-only exception to the automatic
no-refund-on-ambiguous-result rule.

Administrative reopening of a rejected withdrawal or transfer must also debit
the previously refunded total from the original wallet in the same database
transaction as the `failed/cancelled` → `pending` transition. If the wallet
cannot cover it, leave the transaction rejected and report the insufficiency.
