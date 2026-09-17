---
name: AfribaPay deposit OTP return URLs
description: Provider-facing callback and return URL requirements for authenticated deposit OTP confirmation
---

The authenticated deposit OTP confirmation route must construct valid return and cancel URLs even when `APP_URL` is not present in the Node process. Use the current request origin as a fallback, as in the public payment-link OTP route, and include the transaction reference in the redirect query.

**Why:** AfribaPay can report an opaque internal error when it receives a malformed `undefined/...` return URL. The public payment-link route already avoided this, while the dashboard deposit route did not.

**How to apply:** When adding or changing an AfribaPay OTP confirmation path, compare both authenticated deposit and public payment-link implementations and test with `APP_URL` unset.