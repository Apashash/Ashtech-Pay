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
After successful TOTP code verify, now sets BOTH:
- `_avs` (3-day TTL) — makes `requireAdmin` pass
- `_pav` (30-min TTL) — otp-status panel check
Also populates `adminVerifiedSessions` in-memory map.

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

## Frontend flows

### Login flow (password → TOTP)
- `/api/auth/login` returns `{ requiresAdminOtp: true, adminLoginToken }`
- `login.tsx` saves token to sessionStorage, redirects to `/admin-login-otp`
- `/admin-login-otp` page reads token from sessionStorage, calls `/api/auth/admin-login-otp`
- On success: session created with `_avs`, redirects to admin dashboard

### Logo-click flow (5 clicks on logo)
- `dashboard-layout.tsx` handleLogoClick → redirects to `/admin-panel-verify`
- `/admin-panel-verify` page calls `GET /api/admin/otp-status`
  - If already verified and no needsPanelVerify → auto-redirect to admin
  - If totpEnabled=false → toast error, redirect to dashboard
  - Otherwise → show TOTP form
- On success: `admin-panel-verify` endpoint sets `_avs` + `_pav`, redirects to admin

## What NOT to do
- Do not add `ADMIN_OTP_BYPASS` env var back — it was removed intentionally
- Do not set `_avs` without verifying the TOTP code
- Do not add useEffect bypasses in admin-login-otp.tsx or admin-panel-verify.tsx
