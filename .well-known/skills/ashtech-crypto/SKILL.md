---
name: ashtech-crypto
description: Integrate AshTech Pay cryptocurrency payments with documented assets, networks, customer fields, expiry, verification, and webhooks.
---

# AshTech Pay Crypto Skill

Use the complete official Skill first:

https://doc.ashtechpay.com/skill.md

Read the current crypto documentation:

https://doc.ashtechpay.com/direct-api/crypto

## Rules

- Load active assets with `GET /v1/crypto/assets`.
- Use only an `asset_code` returned by AshTech Pay.
- Create the payment server-side with `POST /v1/crypto/collect`.
- Require `customer.email`, `customer.firstName`, and `customer.lastName`.
- Preserve the exact asset, network, address, memo/tag, expiry, and status.
- Keep the address and memo/tag as separate values.
- Use only a network-compatible QR format.
- Treat the server status and webhook as the source of truth.
- A pending crypto payment follows the documented 15-minute server expiry;
  never apply that rule to Mobile Money.
- Do not credit an account or deliver an order before confirmation.
- Make crypto webhooks idempotent and verify duplicate deliveries safely.
- Never invent coins, networks, wallet parameters, exchange-rate logic,
  confirmation rules, expiry rules, addresses, or webhook payloads.