---
name: Admin TOTP mandatory enforcement
description: How mandatory Google Authenticator is enforced for all admin panel access — server-side in requireAdmin, at login, and frontend flows.
---

# Admin TOTP mandatory enforcement

## The rule
Google Authenticator is mandatory for admin login and admin panel access. The admin PIN remains disabled by explicit project configuration.

## Why
The administrator explicitly re-enabled the password → Google Authenticator flow. The PIN remains off, so do not reintroduce it unless separately requested.

## How it works now

### Backend — `requireAdmin` (server/routes.ts)
The TOTP gate is enabled by the fixed server-side requirement. Admin requests fail closed unless the account has a configured secret and the current session has a valid TOTP verification.

### Backend — `/api/auth/login`
Admin password verification creates a short-lived pending challenge; the session and bearer token are issued only after Google Authenticator succeeds.

### Backend — `/api/auth/admin-panel-verify`
The endpoint verifies a fresh Google Authenticator code before the panel opens when the panel verification grant is missing or expired.

### Backend — panel PIN gate
The PIN middleware and panel PIN gate remain disabled. If re-enabled later,
the PIN must remain server-side and never be sent to the browser or logged.

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

### Mobile IP rotation and inactivity window

Admin TOTP and panel grants expire after 48 hours without successful authenticated
panel activity. A network IP change alone does not invalidate a verified admin
session; `_avsIp` remains diagnostic/rebinding metadata, while an unbound `_avs`
is still rejected.

**Why:** Mobile carriers can rotate public IP addresses during an otherwise active
session. Treating every change as a new authentication event caused repeated TOTP
prompts unrelated to inactivity.

**How to apply:** Keep the grant bound to the authenticated session and its 48-hour
sliding inactivity deadline. Log and rebind IP changes, but do not remove mandatory
TOTP or accept legacy sessions that have no recorded IP binding.

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
  - A valid TOTP+PIN panel grant is reused; after 48h without panel activity,
    show the TOTP form followed by the PIN form
- On success: the PIN endpoint creates `_ppv`, then the client opens the admin path

## What NOT to do
- Do not add `ADMIN_OTP_BYPASS` env var back — it was removed intentionally
- Do not set `_avs` without verifying the TOTP code
- Do not treat `_pav` as sufficient panel access; the PIN gate and `_ppv` are required
- Do not add useEffect bypasses in admin-login-otp.tsx or admin-panel-verify.tsx
