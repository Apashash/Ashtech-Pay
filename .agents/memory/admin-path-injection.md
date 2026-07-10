---
name: Admin path injection — Plesk/Passenger env var issue
description: How window.__ADMIN_PATH__ is injected and why the .htaccess must use passthrough (not static index.html) for SPA refresh to work.
---

# Admin path injection — Plesk/Passenger

## The rule
- `.htaccess` SPA fallback MUST use `RewriteRule ^ - [QSA,L]` (passthrough to Passenger/Node.js), NOT `RewriteRule ^ index.html [QSA,L]` (static file).
- `server/static.ts` catch-all (`app.use("*", ...)`) MUST inject `window.__ADMIN_PATH__` on **every** served page, not just admin pages.

**Why:** If Apache serves `index.html` statically, Node.js is bypassed and never injects `window.__ADMIN_PATH__`. React's `getAdminPath()` falls back to localStorage, then `/admin` — causing 404 on every admin page refresh when localStorage is empty.

## The env var problem
`VITE_ADMIN_PATH` is set in Plesk but Passenger may not pass it to `process.env`. Fix: `server/index.ts` now loads `.env` manually at startup (no dotenv dependency). Variables already in `process.env` (set by Passenger) take priority over `.env` file values.

**How to apply:** If `VITE_ADMIN_PATH` is missing from `process.env` at runtime, check:
1. Is it in Plesk's **Node.js Application Settings > Environment Variables** (correct place)?
2. Or only in Apache/nginx settings (wrong place — not passed to Node.js)?
3. Fallback: add `VITE_ADMIN_PATH=/your-path` to the `.env` file in the app root on the server.

## Build-time injection (secondary)
`client/index.html` also has a `%VITE_ADMIN_PATH%` Vite substitution as a secondary mechanism. Only works if `VITE_ADMIN_PATH` is available at Vite build time. The Replit build workflow does NOT have this var, so it's a no-op here — server-side injection is the primary mechanism.

## Server-side disk cache (added for extra resilience)
`resolveAdminPath()` in `server/static.ts` also persists the last known-good
`VITE_ADMIN_PATH` to `uploads/.admin-path-cache` whenever the env var is present.
If Passenger fails to pass the env var on a later restart, the server reads this
disk cache instead of hardcoding `/admin` — protects ALL clients (first visit,
incognito, cleared cache), not just browsers with a populated localStorage.
Logs `[AdminPath]` warnings when the env var is missing so it's visible which
mechanism (env / disk cache / hardcoded fallback) is actually in play.

## Files involved
- `client/public/.htaccess` — SPA passthrough rule (last block)
- `server/static.ts` — always-inject logic in `app.use("*", ...)`
- `server/index.ts` — `.env` file loader (top of file, before imports)
- `client/index.html` — build-time `%VITE_ADMIN_PATH%` injection (secondary)
- `client/src/lib/adminPath.ts` — client fallback chain: injection → localStorage → "/admin"
