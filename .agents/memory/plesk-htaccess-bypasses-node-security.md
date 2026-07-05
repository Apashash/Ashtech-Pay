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

**Diagnosing partial fixes from a re-scan:** if a follow-up scan shows some probe paths now 403 (e.g.
package.json) but others still 200 (e.g. `/.git/HEAD`, `/actuator/env`, `/wp-config.php`), that's evidence
production is running an *older intermediate* version of `.htaccess`/dist than what's currently committed —
not that the fix approach is wrong. Ask the user to confirm they pulled the latest commit and restarted,
rather than re-diagnosing from scratch.

**False positives to expect from generic path scanners:** any path whose name matches sensitive keywords
(`/wallet`, `/wallets`, `/transactions`, `/payments`, `/banking`, `/orders`, `/checkout`) will show HTTP 200
in a scan simply because it's a legitimate SPA client route (wouter) — the SPA shell always returns 200 for
unmatched client paths, and the real data behind them requires session auth at the API level. Don't block
these in `.htaccess`/probe lists; blocking them would break real app functionality. Only block paths that
are never real app routes.

**Uploads passthrough gotcha:** `/uploads` is served by `express.static` in Node (KYC documents etc.), not
by Apache directly — it must be added to the `.htaccess` passthrough alongside `/api/` (`RewriteRule
^uploads/ - [L]`) or Apache's SPA fallback will intercept it and return `index.html` (200) instead of the
actual file/Node 404, silently breaking uploads in production.

**When repeated .htaccess fixes don't show up in re-scans at all:** if MULTIPLE rebuild+redeploy cycles
still show the exact same 200s on paths the `.htaccess` already blocks (not just partial drift — literally
no change at all), suspect Plesk is serving this domain with "serve static files directly by nginx" /
"Smart static files processing" enabled. In that mode Nginx answers static-file-shaped requests directly
and NEVER consults `.htaccess` (an Apache-only mechanism) — no amount of `.htaccess` editing will ever fix
it. The real fix is an equivalent Nginx `location` block pasted into Plesk's "Additional nginx directives"
for that domain (kept in `plesk-nginx-security.conf` at repo root). This is a manual, external panel change
the agent cannot perform — must hand the file to the user with exact Plesk menu paths.
