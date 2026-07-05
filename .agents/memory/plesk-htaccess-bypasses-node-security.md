---
name: Plesk/.htaccess SPA fallback bypasses Node security middleware
description: Why production security scans can show 200 on /.env, /wp-admin, /.git etc. even when Node's botGuard/probe-blocker already 404s them correctly in dev.
---

Ashtech Pay's production deployment runs on Plesk (Apache + Passenger), separate from the Replit dev
environment. `dist/public/.htaccess` (built from `client/public/.htaccess`) is served by Apache and can
rewrite **any** non-existent-file request straight to `index.html` with a 200 status — before the request
ever reaches Node/Express. This means Node-side protections (`server/botGuard.ts` honeypot list,
`server/routes.ts` PROBE_PREFIXES probe-path blocker) are completely bypassed for any path Apache
intercepts first, even though they work correctly when tested against the Node dev server directly.

**Why this matters:** a security scan against the live domain can show CRITICAL/HIGH findings (200 on
`/.env`, `/wp-admin`, `/.git/config`, `/shell.php`, etc.) that look like exposed secrets, while the same
paths 404 correctly in the Replit dev/preview environment — the two environments enforce security at
different layers (Apache vs Node) and can drift out of sync.

**How to apply:** whenever adding a new honeypot/probe path to `server/botGuard.ts` or
`server/routes.ts` PROBE_PREFIXES, add the equivalent Apache `RewriteRule ... - [F,L]` to
`client/public/.htaccess` too (NOT the project-root `.htaccess`, which is a leftover/unused file — only
`client/public/.htaccess` gets copied into `dist/public/` at build time and is what Plesk actually serves).
Use `[F,L]` (403, no redirect) rather than `[R=404,L]` — an external redirect for a 404 causes a documented
Safari iOS zero-byte-download bug on this project. After editing, run `npm run build` and verify
`dist/public/.htaccess` contains the new rule before considering the fix complete — the Replit dev server
alone cannot validate the fix, since the vulnerability is in the Apache config, not Express.

Also remember: even after committing this fix, the actual Plesk production host must pull the latest code
and restart before the fix takes effect there — Replit's environment has no control over that external host.
