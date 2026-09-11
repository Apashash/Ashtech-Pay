---
name: Bearer device sessions
description: Why device-session management must persist the current Bearer-authenticated session before reading or bulk deleting session rows.
---

Device-session management must persist a valid current Bearer-authenticated request into the express session store before listing sessions or deleting other devices. Bulk logout must then exclude the current session SID and rotate the current token.

**Why:** Bearer authentication can identify a user without an existing persisted express-session row. Without an explicit save, the current device appears disconnected from the session list, and a bulk operation can fail to distinguish it from other devices.

**How to apply:** Keep the valid-token check before persistence so revoked tokens cannot recreate sessions. Await the session-store write before reading or deleting rows, and filter bulk deletion by the current SID.

Admin TOTP grants must also recover the durable session associated with the verified Bearer token when a mobile browser presents a fresh Express session on the next request.

**Why:** Mobile Safari may not return the session cookie consistently, so the TOTP request and the first admin API request can have different session IDs even though they use the same signed token.

**How to apply:** Match the verified session by the authenticated token timestamp plus user ID, expiration, and IP; never fall back to a user-wide admin grant.

When several durable session rows share one token timestamp, prefer the row with the newest valid panel/admin factors and search all configured session pools.

**Why:** Cookie-less navigation can leave an older row without `_pav` beside the freshly verified row; taking the first database result makes a successful panel verification appear to expire immediately.

**How to apply:** Recover `_pav`, `_ppv`, and `_avs` from the strongest matching row rather than relying on database row order or stopping after an empty first-pool result.

The middleware that actually runs for requests must persist `userId` and `tokenIssuedAt` when it authenticates a cookie-less Bearer request; a separate unused helper does not protect the flow.

**Why:** A panel-TOTP session saved without the token timestamp cannot be found on the next mobile request, so the admin is sent back to authentication even though `_pav` was valid.

**How to apply:** Await the current session save before continuing the request, then let Bearer recovery match the saved panel factors on subsequent requests.