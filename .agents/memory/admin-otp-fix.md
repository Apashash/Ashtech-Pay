---
name: Admin OTP verification fix
description: Why the admin 2FA OTP never redirected to the panel — in-memory Map broken in multi-process deployments.
---

## The Rule
Never store the admin OTP "verified" flag in a server-side in-memory Map (`adminVerifiedSessions`). Use the PostgreSQL-backed session instead.

**Why:** The old code stored verification in a `Map<sessionID, {userId, expiresAt}>` on the Node.js process. In PM2 cluster mode (multiple processes) or after any server restart, the Map is empty on other processes. POST verify-otp goes to process A (sets map), GET otp-status goes to process B (empty map) → always returns `verified: false` → user stuck on OTP screen forever. Telegram showed "ADMIN CONNECTÉ AVEC SUCCÈS" (server-side succeeded) but frontend never redirected.

**How to apply:**
- In `session.ts` declaration: use `_avs?: number` (expiry timestamp, not boolean flag)
- On verify: `req.session._avs = Date.now() + TTL; await session.save()`
- On status check: `typeof req.session._avs === "number" && req.session._avs > Date.now()`
- On request-otp (invalidate): `delete req.session._avs`
- On logout: `session.destroy()` handles it automatically

## SIEM false alerts
The legacy code used `adminOtpVerified` as the session key. The SIEM watchdog detected this in old DB sessions and sent repeated Telegram alerts. Fix:
1. `purgeOldAdminOtpSessions()` called at startup deletes all old sessions with this flag
2. SIEM `checkSessionAnomalies()` now auto-deletes + alerts if `adminOtpVerified` reappears (real attack signal)
