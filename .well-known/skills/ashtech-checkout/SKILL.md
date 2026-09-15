---
name: ashtech-checkout
description: Integrate AshTech Pay Hosted Checkout while keeping checkout keys server-side and confirming payment before fulfillment.
---

# AshTech Pay Hosted Checkout Skill

Use the complete official Skill first:

https://doc.ashtechpay.com/skill.md

Then read the current Hosted Checkout documentation:

https://doc.ashtechpay.com/embedded-checkout

## Rules

- Inspect the existing project and add Checkout without rebuilding it.
- Keep the `hp_live_...` Hosted Checkout key on the merchant server.
- Create the payment link from the merchant backend.
- Send only the public payment link to the browser.
- Use one stable `Idempotency-Key` for one merchant order.
- Do not create a new payment link just because a popup or redirect opened.
- Do not treat a success page or browser redirect as proof of payment.
- Configure the documented HTTPS `notify_url` when webhooks are required.
- Verify the transaction server-side or process the verified webhook before
  fulfilling the order.
- Make duplicate webhook and refresh handling idempotent.
- For crypto Checkout, collect `customer.email`, `customer.firstName`, and
  `customer.lastName`, and preserve the exact asset/network values documented by
  AshTech Pay.
- Never invent Checkout fields, SDK methods, popup behavior, or response
  formats.