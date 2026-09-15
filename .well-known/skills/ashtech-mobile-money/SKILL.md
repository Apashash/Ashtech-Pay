---
name: ashtech-mobile-money
description: Integrate AshTech Pay Mobile Money flows including catalogues, USSD Push, Wave, OTP, status handling, and webhooks.
---

# AshTech Pay Mobile Money Skill

Use the complete official Skill first:

https://doc.ashtechpay.com/skill.md

Read the current Direct API and payment-flow documentation:

https://doc.ashtechpay.com/direct-api/mobile-money
https://doc.ashtechpay.com/direct-api/payment-flows

## Rules

- Load active countries, operators, and currencies before creating a payment.
- Validate amount, country, operator, phone, currency, and reference on the
  server.
- Use the exact values returned by the AshTech Pay catalogue.
- Create the payment with the documented `POST /v1/collect` request.
- Handle USSD Push, Wave, OTP SMS, and OTP USSD according to current docs.
- Use the OTP reference returned by AshTech Pay for any documented retry.
- Treat pending, completed, failed, cancelled, OTP-required, and timeout
  states exactly as documented.
- Do not blindly retry a timed-out initiation.
- Verify the transaction server-side or through a verified webhook.
- Make order fulfillment and webhook processing idempotent.
- Never hardcode undocumented provider codes or assume country currencies.