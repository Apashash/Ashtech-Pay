---
name: Public payment provider timeout
description: Why a public payment-link request may be pending even when the browser reports a timeout.
---

Public Mobile Money initiation can be persisted as `pending` and accepted by
the provider while the browser is still waiting for the final HTTP response.
The checkout timeout must therefore leave enough time for active configuration
and provider initiation, otherwise users may retry and create duplicate charges.

**Why:** A real 200 XAF MTN Cameroon attempt was present as a pending
PawaPay transaction after Safari displayed its timeout message.

**How to apply:** Prefer a generous bounded client timeout and show the pending
provider-confirmation state when the initiation response arrives; never retry a
timed-out Mobile Money initiation automatically.