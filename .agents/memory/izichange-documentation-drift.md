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

## Keep payout API hosts separate from the general Pay-in host

IziChange's payout guide and its generic test/live quickstart describe different live API hosts. Resolve the payout base URL separately from the base used for existing Pay-in endpoints, and verify both test and live hosts against endpoint-specific documentation.

**Why:** Reusing the general API host for payouts can send requests to the wrong API service even when the credentials and endpoint path look valid.

**How to apply:** Keep separate host resolution for payout create/status calls; reconfirm the endpoint-specific host before changing it.