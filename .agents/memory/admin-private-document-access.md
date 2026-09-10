---
name: Admin private document access
description: Protected KYC images and PDFs must be fetched with the Bearer token before display.
---

KYC document URLs must remain behind the authenticated image proxy. Admin
screens should fetch the bytes with the stored Bearer token and display a
short-lived object URL; direct img or new-tab links cannot attach the
Authorization header and will return unauthorized.

**Why:** Admin authentication uses localStorage Bearer tokens to support
mobile and iframe behavior, so browser resource requests do not reliably carry
the token automatically.

**How to apply:** Do not make KYC storage public or put tokens in query strings.
Use authenticated fetches for images and PDFs, revoke object URLs when the
submission view closes, and preserve the server-side ownership/admin check.