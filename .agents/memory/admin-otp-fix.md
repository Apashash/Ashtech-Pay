---
name: Admin OTP multi-process fix
description: OTP verification AND OTP code storage must use session (DB-backed), not in-memory Maps, for PM2 multi-worker setups.
---

## The Rule
Never store the admin OTP "verified" flag OR the OTP code itself in server-side in-memory Maps. Use the PostgreSQL-backed session for both.

**Why:** PM2 cluster mode routes requests round-robin. `POST /api/admin/request-otp` goes to worker 1 (stores OTP code in `adminOtpStore` Map), but `POST /api/admin/verify-otp` goes to worker 2 (Map is empty → "Aucun code demandé" → permanent 403 loop). Same issue for `adminVerifiedSessions` (_avs flag). Storing in PostgreSQL session makes it visible to all workers.

**How to apply (current implementation in `server/routes.ts`):**

### OTP Code (`_otpCode` + `_otpExpiry`)
- On `request-otp`: set `req.session._otpCode = code; req.session._otpExpiry = expiry; await session.save()` AND keep in `adminOtpStore` as fast-path
- On `verify-otp`: check in-memory Map first, then `req.session._otpCode`, then direct DB session query (tier-3 fallback)
- Cleanup on success: delete from both Map and session
- Session fields declared in `SessionData` interface: `_otpCode?: string; _otpExpiry?: number`

### OTP Verified (`_avs`)
- On verify success: `req.session._avs = expiresAt; await session.save()` AND set `adminVerifiedSessions` Map
- On requireAdmin check: check Map (instant) → `req.session._avs` → direct DB session query
- TTL: `ADMIN_OTP_SESSION_TTL_MS = 4 * 60 * 60 * 1000` (4 hours)

## SIEM false alerts
Legacy code used `adminOtpVerified` as the session key. `purgeOldAdminOtpSessions()` called at startup cleans up old sessions. SIEM auto-deletes + alerts if `adminOtpVerified` reappears (real attack signal).
