---
name: Crypto customer contract
description: Contract for customer validation, diagnostic errors, and QR rendering in crypto payment surfaces.
---

Crypto Hosted Checkout and Direct API requests require a valid customer object containing non-empty email, firstName, and lastName. refundAddress and notify_url remain optional. The tester must render QR codes locally and keep address and memo/tag separate.

**Why:** The upstream validator requires all three customer identity fields for crypto initiation. Making the application contract explicit prevents synthetic names from being sent to the provider and keeps Hosted Checkout, Direct API, and documentation aligned.

**How to apply:** Validate email, firstName, and lastName before calling the provider, reject malformed customer shapes explicitly, preserve optional fields through parsing, validate HTTPS webhook URLs, return safe error details with request IDs for crypto endpoints, and use the local QR component in every crypto testing/payment surface.