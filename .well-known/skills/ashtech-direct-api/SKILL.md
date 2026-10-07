---
name: ashtech-direct-api
description: Integrate AshTech Pay Direct API payments with server-side authentication, catalogues, transaction verification, and idempotent fulfillment.
---

# AshTech Pay Direct API Skill

Use the complete official Skill first:

https://doc.ashtechpay.com/skill.md

Then implement only the Direct API flow documented at:

https://doc.ashtechpay.com/direct-api/overview

## Rules

- Inspect the existing project before editing it.
- Keep the `ak_...` Direct API key on the server.
- Load `GET /v1/countries` and use the active operator and currency values.
- The default country catalogue is for deposits. For withdrawals, use
  `GET /v1/countries?operation=payout` and follow the dedicated payout Skill:
  https://doc.ashtechpay.com/.well-known/skills/ashtech-payouts/SKILL.md
- Load `GET /v1/fees` when the integration needs fee details.
- Create Mobile Money payments with `POST /v1/collect`.
- Create crypto payments with `POST /v1/crypto/collect`.
- Load crypto assets with `GET /v1/crypto/assets`.
- Store the returned transaction ID and unique merchant reference.
- Check `GET /v1/transaction/:id` server-side when verifying status.
- Treat the initial response and browser redirect as non-final.
- Wait for a documented completed webhook or server verification before
  crediting an account or delivering an order.
- Make retries and order fulfillment idempotent.
- Never invent undocumented fields, provider codes, currencies, or networks.

## Crypto requirement

When crypto is selected, require `customer.email`, `customer.firstName`, and
`customer.lastName`. Use the exact `asset_code`, network, address, and
memo/tag returned by AshTech Pay. Never send funds or fulfill an order before
server confirmation.