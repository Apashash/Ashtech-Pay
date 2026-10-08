---
name: ashtech-direct-api
description: Integrate AshTech Pay Direct API payments and wallet conversions with server-side authentication, catalogues, status verification, and idempotent processing.
---

# AshTech Pay Direct API Skill

Use the complete official Skill first:

https://doc.ashtechpay.com/skill.md

Then implement only the Direct API flow documented at:

https://doc.ashtechpay.com/direct-api/overview

For immediate or automatic wallet conversions, also read:

https://doc.ashtechpay.com/docs/direct-api/wallets-conversions

## Rules

- Inspect the existing project before editing it.
- Keep the `ak_...` Direct API key on the server.
- Load `GET /v1/countries` and use the active operator and currency values.
- The default country catalogue is for deposits. For withdrawals, use
  `GET /v1/countries?operation=payout` and follow the dedicated payout Skill:
  https://doc.ashtechpay.com/.well-known/skills/ashtech-payouts/SKILL.md
- Load `GET /v1/fees` when the integration needs fee details.
- For wallet operations, require `user_id` to match the profile that owns the
  Bearer API key.
- Read wallet balances with `GET /v1/wallets?user_id=...`. Use the exact
  returned `wallet_currency` as the source `from_currency`.
- For the destination, load `GET /v1/countries` and send the chosen
  `destination_country_code`; do not guess or send a target wallet code.
- Create an immediate conversion with `POST /v1/conversions`. Require a stable
  unique `reference`; reusing it with different parameters returns
  `409 reference_conflict`. Optional `notify_url` must be public HTTPS.
  Insufficient balances and amounts below the configured minimum are rejected
  before debit. Track the result with
  `GET /v1/conversions/{conversion_id}?user_id=...` or a verified webhook.
- Treat `202` as pending asynchronous processing: the source is debited before
  the destination wallet is credited. A cancelled conversion refunds the
  source.
- Automatic rules use `POST /v1/auto-conversion-rules`,
  `GET /v1/auto-conversion-rules?user_id=...`, and
  `DELETE /v1/auto-conversion-rules/{rule_id}?user_id=...`. Create a rule with
  `user_id`, `from_currency`, `destination_country_code`, and optional
  `notify_url`. Only one active rule is allowed per source currency. Creating
  one may immediately convert an existing balance; track
  `initial_conversion_id` when returned. Later credits to the source wallet
  trigger it. Deleting a rule does not cancel a conversion already pending.
- Create Mobile Money payments with `POST /v1/collect`.
- Create crypto payments with `POST /v1/crypto/collect`.
- Load crypto assets with `GET /v1/crypto/assets`.
- Store the returned transaction ID and unique merchant reference.
- Check `GET /v1/transaction/:id` server-side when verifying status.
- Treat the initial response and browser redirect as non-final.
- Wait for a documented completed webhook or server verification before
  crediting an account or delivering an order.
- Make retries and order fulfillment idempotent.
- Never invent undocumented fields, operator codes, currencies, or networks.

## Crypto requirement

When crypto is selected, require `customer.email`, `customer.firstName`, and
`customer.lastName`. Use the exact `asset_code`, network, address, and
memo/tag returned by AshTech Pay. Never send funds or fulfill an order before
server confirmation.