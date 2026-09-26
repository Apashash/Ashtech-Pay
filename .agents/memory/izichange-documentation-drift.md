---
name: IziChange documentation drift
description: Provider docs disagree on webhook signatures, PAYIN limits, and endpoint-specific API hosts.
---

## Keep compatible webhook signature checks

Provider documentation describes conflicting callback-signature formats. Keep the compatible HMAC verification variants already supported; do not narrow validation to a single format without confirmation from IziChange.

**Why:** A strict interpretation of only one documented format can reject legitimate provider callbacks.

**How to apply:** Recheck both the webhook guide and real provider behavior before changing callback verification.

## Preserve the lower documented PAYIN ceiling

When provider documentation gives conflicting PAYIN maximums, retain the lower 2,000,000 cap until IziChange confirms the correct production limit.

**Why:** Accepting amounts above the lower cap risks avoidable provider rejections and inconsistent checkout behavior.

**How to apply:** Do not raise the limit based on one conflicting page; obtain provider confirmation first.

## Use the live payout host from the current API reference

The current payout API reference documents `https://api.pay.izichange.com/v1/payouts` for live calls, matching the general live API host. Older payout-guide material may show the conflicting `api.izichangepay.com`; do not rely on that stale host.

**Why:** Using the stale host can fail DNS resolution before IziChange returns an HTTP response, leaving a payout in manual review.

**How to apply:** Recheck the current endpoint-specific API reference before changing the payout host. Keep test/live selection based on the configured key mode, and keep host-selection tests aligned with that reference.

## Payout scope and structured rejection codes

The direct payout endpoint requires the API-key scope `payouts:write`. A missing scope returns HTTP 403 with code `INSUFFICIENT_SCOPE`; IP allowlist failures can also return 403. IziChange documents `ASSET_DISABLED_PLATFORM` and `ASSET_DISABLED_MERCHANT` as explicit 400 payout rejections.

**Why:** A rejected payout can leave the user's wallet debit reserved while no payout record exists at IziChange. Authentication and allowlist errors are not proof that a payout was created, but the project's payout policy keeps those cases in manual review rather than risking an automatic refund.

**How to apply:** When a payout is pending without an IziChange ID, verify the deployed key's `payouts:write` scope and server IP allowlist, and inspect the provider status/code. Treat the documented asset-disabled codes as definitive; keep scope, auth, rate-limit, insufficient-provider-balance, and ambiguous errors out of automatic refund handling.