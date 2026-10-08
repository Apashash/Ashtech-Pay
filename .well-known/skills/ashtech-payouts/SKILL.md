---
name: ashtech-payouts
description: Integrate AshTech Pay Mobile Money and USDT payouts with country/operator discovery, correct wallet selection, idempotency, and final-status verification.
---

# AshTech Pay Payouts Skill

Use the complete official Skill first:

https://doc.ashtechpay.com/skill.md

Read the current payout and country-catalogue documentation before implementing:

- https://doc.ashtechpay.com/docs/direct-api/payouts
- https://doc.ashtechpay.com/docs/reference/countries

## Mobile Money payouts

- Create withdrawals with `POST /v1/payouts/mobile-money`.
- Load the payout-specific catalogue with
  `GET /v1/countries?operation=payout`. The default `GET /v1/countries`
  catalogue is deposit-focused and is not a substitute for the payout catalogue.
- Send the returned country's ISO `code` as `country_code` (for example `CM`,
  `GA`, or `CG`) and use an active withdrawal operator returned for that
  country. Do not send a country name or guess a code.
- `wallet_currency` is only informational. The server resolves the exact wallet
  from `country_code`; do not send that internal wallet code as the country and
  do not silently convert from another wallet.
- Require `user_id` to match the owner of the Bearer API key. Use a stable,
  unique `reference` and reuse it only for the same request parameters.
- Respect `fee_bearer` (`sender` or `recipient`) and the documented optional
  HTTPS `notify_url`. An insufficient balance is rejected before the payout
  request is sent.
- A payout never converts funds automatically. If the merchant separately
  requests a wallet conversion, follow
  https://doc.ashtechpay.com/docs/direct-api/wallets-conversions and keep that
  operation separate from the payout.

## USDT and crypto payouts

- Create withdrawals with `POST /v1/payouts/crypto`, not the crypto pay-in
  endpoint `POST /v1/crypto/collect`.
- Load active assets and networks from `GET /v1/crypto/assets`; send an exact
  `asset_code`, a destination address for that network, and
  `destination_memo` when that network requires a memo or tag.
- Require the matching `user_id` and a stable payout `reference`. Respect the
  account-verification requirement and active crypto fees and limits. Never
  silently convert another wallet to fund a payout.

## Status, retries, and webhooks

- A successful initiation response is not automatically a final payout result.
  Preserve the returned AshTech transaction ID and check
  `GET /v1/transaction/{transaction_id}?user_id=...` when status verification
  is needed.
- Verify AshTech webhook signatures and deduplicate events. The documented
  final payout events are `payout.completed` and `payout.failed`.
- Keep uncertain outcomes, including `pending_manual`, pending for
  reconciliation. Never retry an uncertain payout with a new reference or
  submit a duplicate transfer.
- Only report completion or failure after an authoritative server status or a
  verified final webhook.

Never invent country codes, operators, wallet currencies, asset codes, networks,
fees, payout statuses, or undocumented request fields.
