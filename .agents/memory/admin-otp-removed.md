---
name: Admin OTP removed
description: The entire 2-step OTP/TOTP admin login gate was removed. Admins now access the panel directly after standard login.
---

## What was removed
- `requireAdmin` middleware: stripped all OTP tiers (1–4), HMAC token verification, in-memory `adminVerifiedSessions` cache, DB session fallback queries. Only role check + IP blocklist remain.
- `client/src/pages/admin/layout.tsx`: removed all OTP state vars, `otpStatus` query, `requestOtpMutation`, `verifyOtpMutation`, `verifyTotpMutation`, OTP handler functions (`handleOtpInput`, `handleOtpKeyDown`, `handleOtpPaste`), the OTP Gate JSX block (full-screen 2FA screen), and the "session expirée" banner. TOTP *setup* modal kept (optional security feature, not a login gate).
- `client/src/lib/queryClient.ts`: removed `getAdminOtpToken`, `setAdminOtpToken`, `removeAdminOtpToken`, `X-Admin-OTP-Token` header, `requireOtp` event dispatch.
- `client/src/App.tsx`: removed `AdminLoginOtpPage` and `AdminPanelVerifyPage` imports and routes.

## What remains
- `layoutStats` query: `enabled: !!user` (was `!!otpStatus?.verified`)
- TOTP setup/disable modals: still present as optional security configuration (not blocking login)
- IP blocklist: still enforced in `requireAdmin`

**Why:** User explicitly requested removal of all 2-step verification for simpler admin access.
