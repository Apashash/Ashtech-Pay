## UPDATE (2026-07-11): dynamic VITE_ADMIN_PATH mechanism removed
Per explicit user request, the entire env-var/injection/disk-cache system below
was ripped out. The admin path is now a hardcoded constant in
`client/src/lib/adminPath.ts` (`getAdminPath()` just returns it) — no
`window.__ADMIN_PATH__`, no server-side injection, no `%VITE_ADMIN_PATH%`
placeholder, no disk cache. `server/routes.ts`'s scanner-probe guard also
hardcodes the same value now. To rotate the secret path, edit that one
constant (and mirror it in `server/routes.ts` if the guard logic still
references it directly) and rebuild/redeploy. Everything documented below
this point is historical context for *why* the old approach existed and
should not be reintroduced unless the user asks for env-driven configurability
again.

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

## express.static default index.html serving bypasses injection entirely
`app.use(express.static(distPath))` with default options auto-serves
`index.html` for `/` (and any directory-style request) *before* any later
route/middleware runs — including our catch-all that injects
`window.__ADMIN_PATH__`. Symptom: curl shows the raw unreplaced
`%VITE_ADMIN_PATH%` placeholder and a `Last-Modified`/`ETag` header (proof
Express's static file server answered, not our dynamic handler). Fix:
`express.static(distPath, { index: false })` so index.html always falls
through to the injection middleware.

## Passenger multi-worker race (root cause of "sometimes falls back to /admin")
Passenger runs several Node worker processes and load-balances requests across them.
`resolveAdminPath()` MUST be called per-request, never cached once at process startup —
otherwise a worker that failed to receive `VITE_ADMIN_PATH` at boot stays wrong for its
entire lifetime, causing the exact "refresh sometimes lands on /admin" symptom depending
on which worker answers. Per-request resolution + shared disk cache lets all workers
converge on the same value as soon as any one of them has seen the env var.

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
