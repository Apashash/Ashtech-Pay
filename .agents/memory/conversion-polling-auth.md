---
name: Conversion polling authentication
description: Mobile conversion status polling must authenticate the same way as the initiating request.
---

Any browser polling endpoint for an authenticated conversion must include both cookies and the current Bearer authorization headers.

**Why:** Mobile/PWA sessions can rely on the local auth token when cookies are unavailable. If the initial mutation sends the token but the follow-up polling fetch does not, the server returns 401 and the UI silently remains in a pending state even after the worker and Telegram mark the conversion completed.

**How to apply:** Reuse the shared auth-header helper on every conversion-status request and treat unauthorized responses as an authentication/session issue rather than silently polling forever.