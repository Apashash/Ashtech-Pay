---
name: Crypto sandbox optional fields
description: Contract for optional customer data, diagnostic errors, and QR rendering in the crypto API tester.
---

The public crypto API treats customer email and webhook URL as optional. When email is absent, the upstream charge request must omit the entire customer object rather than sending an empty or name-only object. The tester must render QR codes locally and keep address and memo/tag separate.

**Why:** The upstream validator can reject an otherwise valid payment when it receives a customer object without email, while the old sandbox hid the real cause behind a generic server error. The tester also previously had a QR payload helper without rendering a QR.

**How to apply:** Preserve optional fields through parsing, validate supplied email and HTTPS webhook URLs explicitly, return safe error details with request IDs for crypto endpoints, and use the local QR component in every crypto testing/payment surface.