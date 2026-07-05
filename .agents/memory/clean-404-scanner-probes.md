---
name: Clean 404 page for scanner/honeypot probe paths
description: Why known-bad probe paths (wp-admin, .env, phpmyadmin, etc.) must return a real HTML 404 page rather than a bare status or plain-text body.
---

When the server blocks known scanner/honeypot probe paths (WordPress, phpMyAdmin, `.env`, `.git`,
config files, etc.), it must respond with a proper branded HTML 404 page — not `res.status(404).end()`
or plain text like `"Not Found"`.

**Why:** automated security scanners (and third-party audit tools) treat a bare/plain-text 404 response
as an anomaly and generate alarming "vulnerability" reports about it, even though the path itself is
correctly blocked. A normal-looking HTML 404 consistent with the rest of the site reads as unremarkable
to these tools while still leaking zero information to a real attacker.

**How to apply:** use the shared `sendClean404(res)` helper (exported from `server/botGuard.ts`) anywhere
a probe/honeypot path, banned IP, or blocked source-file request is rejected with 404, instead of
`res.status(404).end()` / `.send("Not Found")`. Keep the status code at 404 (never 403 — 403 confirms the
path exists) and always set `Content-Type: text/html`.
