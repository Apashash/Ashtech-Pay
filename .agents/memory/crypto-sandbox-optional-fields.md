---
name: Crypto customer contract
description: Contract for customer validation, diagnostic errors, and QR rendering in crypto payment surfaces.
---

Crypto Hosted Checkout and Direct API requests require a valid customer email. The provider request must always contain a customer object with that email; firstName, lastName, refundAddress, and notify_url remain optional. The tester must render QR codes locally and keep address and memo/tag separate.

**Why:** The upstream validator rejects crypto initiation without an email-bearing customer object, while the old forms allowed the request to reach the provider and exposed the generic `customer must be an object` error. The tester also previously had a QR payload helper without rendering a QR.

**How to apply:** Validate the email before calling the provider, reject malformed customer shapes explicitly, preserve optional fields through parsing, validate HTTPS webhook URLs, return safe error details with request IDs for crypto endpoints, and use the local QR component in every crypto testing/payment surface.