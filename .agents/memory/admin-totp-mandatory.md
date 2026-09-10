---
name: Admin TOTP mandatory enforcement
description: How mandatory Google Authenticator is enforced for all admin panel access — server-side in requireAdmin, at login, and frontend flows.
---

# Admin TOTP mandatory enforcement

## The rule
Every admin/support/finance session MUST have a valid `_avs` (admin verified session) timestamp in order to pass `requireAdmin`. TOTP must also be configured on the account — if not, access is blocked entirely (no fallback).

## Why
Previously, TOTP was "optional" at the middleware level — requireAdmin only checked role + IP blocklist. Both TOTP verification pages had hardcoded bypass redirects (marked "TOTP DÉSACTIVÉ TEMPORAIREMENT") that skipped verification entirely.

## How it works now

### Backend — `requireAdmin` (server/routes.ts)
After IP blocklist check, two new mandatory gates:
1. `user.totpEnabled && user.totpSecret` must be true — else 403 `{ totpNotConfigured: true }`
2. `_avs` check via 3-tier lookup (memory map → session cookie → DB) — else 403 `{ totpRequired: true }`
No env-var bypass (`ADMIN_OTP_BYPASS` removed).

### Backend — `/api/auth/login`
Admin/support/finance roles intercepted before session creation:
- TOTP not configured → 403 `{ totpNotConfigured: true }`
- TOTP configured → create pending login token, return `{ requiresAdminOtp: true, adminLoginToken }`
- Normal (non-admin) users still get a full session immediately

### Backend — `/api/auth/admin-panel-verify`
After successful panel TOTP code verify, it sets:
- `_avs` (24h inactivity TTL) — makes `requireAdmin` pass and slides on panel activity
- `_pav` (24h inactivity TTL) — panel TOTP gate and activity window
- clears any previous `_ppv` panel-PIN grant, so the PIN must follow the fresh TOTP
Also populates `adminVerifiedSessions` in-memory map.

### Backend — panel PIN gate
- `/api/auth/admin-panel-pin-verify` accepts the PIN only after a valid panel `_pav`
  bound to the current IP, then stores `_ppv` with the same IP binding.
- `requireAdmin` rejects admin API access until `_ppv` is valid; the PIN is never
  sent to the browser or logged.

### Challenge and session invariants
- Admin password login never creates a session or bearer token before TOTP succeeds.
- Pending login challenges are stored in PostgreSQL and atomically claimed/consumed, so
  concurrent requests cannot reuse one valid code.
- `_avs` without a matching `_avsIp` is rejected; legacy/unbound admin sessions must
  complete a fresh TOTP verification.
- The former email/Telegram admin OTP endpoints are retired and cannot establish
  admin access.

**Why:** A permanent enforcement rule is only meaningful if old alternate OTP paths,
legacy session flags, and concurrent challenge submissions cannot turn into a
fallback.

**How to apply:** Any future admin authentication factor must either be part of the
password→TOTP challenge or be explicitly prevented from setting `_avs`, issuing an
admin token, or bypassing `requireAdmin`.

### MySQL challenge compatibility

The MySQL pool adapter must map `ResultSetHeader.affectedRows` to its compatible `rowCount`. The admin login challenge uses an atomic `UPDATE` and treats `rowCount === 0` as an expired challenge.

**Why:** Without this mapping, a successful MySQL claim was reported as zero affected rows, so every valid Google Authenticator code appeared to have an expired login session.

**How to apply:** Keep the adapter's result normalization correct for every `INSERT`, `UPDATE`, and `DELETE` path that relies on `rowCount`, especially pending admin-login claims and session housekeeping.

### Mobile panel TOTP handoff

The panel TOTP handoff permits a short IP transition window for mobile networks, then rebinds the session to the IP present on the first panel request. This applies whether the temporary PIN gate is enabled or disabled; normal panel requests remain IP-bound.

**Why:** A 4G/5G address can rotate between the TOTP request and the first protected panel request, causing a valid TOTP to be rejected with `totpRequired` and sending the admin back to Google Authenticator.

**How to apply:** Keep the handoff narrow and tied to a freshly verified panel TOTP; do not turn off the broader session IP checks or mandatory TOTP enforcement. If a PIN is later restored, the same handoff window must cover the TOTP-only-to-PIN transition.

### Panel PIN error ordering

The panel PIN endpoint validates the submitted PIN before checking the panel TOTP session. A wrong PIN must return the PIN error; only a correct PIN may proceed to the TOTP/session gate.

**Why:** Checking the session first made every PIN typo look like an expired Google Authenticator session when the mobile IP or panel session was not recognized.

**How to apply:** Preserve the fail-closed grant behavior: validating a correct PIN never opens the panel by itself, and the TOTP plus session/IP checks must still pass before `_ppv` is stored.

### Panel verification query state

After a successful panel PIN, clear both `needsPanelPin` and `needsPanelVerify` in the client query cache, and do not redirect while the admin-access query is fetching.

**Why:** A stale `needsPanelVerify` flag from the pre-PIN query could immediately redirect a valid PIN success back to the Google Authenticator page, even when the server had granted panel access.

**How to apply:** Treat the post-verification query state as a complete success state and let the server refresh finish before the admin layout applies its redirect guard.

### Session-save failures

Panel TOTP and PIN endpoints must not return success until `req.session.save()` completes without an error.

**Why:** Reporting a successful factor before persisting its session flags sends the browser to the admin route, where the first protected request correctly sees no grant and redirects back to Google.

**How to apply:** Return a non-success response that keeps the user on the current verification step, and inspect the Plesk session-store/database logs before changing the TOTP flow.

## Frontend flows

### Login flow (password → TOTP)
- `/api/auth/login` returns `{ requiresAdminOtp: true, adminLoginToken }`
- `login.tsx` saves token to sessionStorage, redirects to `/admin-login-otp`
- `/admin-login-otp` page reads token from sessionStorage, calls `/api/auth/admin-login-otp`
- On success: session created with `_avs`, clears panel grants, redirects to `/dashboard`

### Logo-click flow (5 clicks on logo)
- `dashboard-layout.tsx` handleLogoClick → redirects to `/admin-panel-verify`
- `dashboard/index.tsx` uses the same redirect for its hidden five-click gesture
- `/admin-panel-verify` page calls `GET /api/admin/otp-status`
  - If totpEnabled=false → toast error, redirect to dashboard
  - A valid TOTP+PIN panel grant is reused; after 24h without panel activity,
    show the TOTP form followed by the PIN form
- On success: the PIN endpoint creates `_ppv`, then the client opens the admin path

## What NOT to do
- Do not add `ADMIN_OTP_BYPASS` env var back — it was removed intentionally
- Do not set `_avs` without verifying the TOTP code
- Do not treat `_pav` as sufficient panel access; the PIN gate and `_ppv` are required
- Do not add useEffect bypasses in admin-login-otp.tsx or admin-panel-verify.tsx
