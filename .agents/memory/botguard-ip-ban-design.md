---
name: botGuard IP-ban design constraints
description: Lessons about server/botGuard.ts IP-ban logic — CGNAT collateral damage and honeypot path collisions with real routes.
---

## CGNAT / shared-IP risk (African mobile networks)
Banning a whole IP for a single suspicious User-Agent request is too aggressive on this app's user base:
many African mobile carriers (LTE/CGNAT) share one public IP across thousands of subscribers, so one
bad request can lock out a huge number of real users.

**Decision:** bad/known-bot User-Agent patterns get their *individual request* rejected (403) but no
longer trigger an IP-level ban. IP bans are reserved for deliberate attacks: honeypot path hits
(fake WordPress/PHP/admin-probe paths no real user would ever request) and suspicious path patterns
(SQL injection, path traversal, XSS).

**Why:** a real bot retrying against the same bad UA still gets blocked every time anyway, so the
IP-ban added collateral damage without meaningfully improving protection.

## Honeypot path list must never overlap real route prefixes
The honeypot matcher does `path === entry || path.startsWith(entry + "/")`. Any entry that is also a
valid prefix of a real, authenticated route (e.g. `/api/admin`) will treat legitimate authenticated
requests under that prefix (e.g. `/api/admin/otp-status`) as a bot honeypot hit and ban the IP for 48h —
even for the app's own admin panel, causing self-lockout.

**How to apply:** before adding any path to `HONEYPOT_PATHS` in `server/botGuard.ts`, grep
`server/routes.ts` for real routes starting with that same prefix. If any exist, don't add the bare
prefix — only add the exact non-existent path.
