---
name: ashtech-webhooks
description: Implement secure, verified, idempotent AshTech Pay webhooks for payment status and order fulfillment.
---

# AshTech Pay Webhooks Skill

Use the complete official Skill first:

https://doc.ashtechpay.com/skill.md

Read the current webhook documentation:

https://doc.ashtechpay.com/direct-api/webhooks

## Rules

- Expose an HTTPS webhook endpoint.
- Read the raw request body before JSON parsing when signature verification
  requires it.
- Verify `X-Ashtech-Timestamp` and `X-Ashtech-Signature` with the configured
  `whsec_...` secret exactly as documented.
- Reject invalid or stale signatures.
- Respond quickly with HTTP 2xx after safely recording the event.
- Deduplicate with the documented event ID, transaction ID, and merchant
  reference.
- Reload the transaction status server-side before crediting or fulfilling.
- Make duplicate deliveries safe.
- Never fulfill an order from a browser redirect or an unverified status.
- Never log webhook secrets, API keys, OTPs, or unnecessary customer/payment
  data.