---
name: Admin requireAdmin Tier 4
description: requireAdmin middleware was missing Tier 4 OTP check (search by userId), causing 403 on PM2 multi-process deployments and showing all zeros on admin dashboard.
---

## The Rule
`requireAdmin` middleware must have the same 4-tier OTP verification as the `otp-status` endpoint.

## The 4 Tiers
1. In-memory `adminVerifiedSessions` Map (instant, same process)
2. `req.session._avs` timestamp (session middleware, DB-backed)
3. Direct DB query by `sessionID` (handles PM2 worker routing mismatch)
4. Direct DB query by `userId` across all sessions with `_avs` set (handles Bearer-token requests or proxy assigning different sessionID)

## Why
On Plesk with PM2 multi-process: `otp-status` returned `verified: true` (had Tier 4), so the admin dashboard rendered. But `requireAdmin` only had Tiers 1-3 — if sessionID lookup failed (different worker), it returned 403. This caused all admin API calls (`/api/admin/stats`, etc.) to silently fail, showing zeros everywhere despite the user being past the OTP gate.

Symptom: Admin dashboard shows all zeros when `ADMIN_OTP_BYPASS=false`, works fine when `=true`.

## How to Apply
When modifying OTP verification logic in `requireAdmin` (server/routes.ts ~line 488), always ensure Tier 4 is present:
```typescript
if (!otpValid && req.userId) {
  const userRow = await sessionPool.query(
    `SELECT sess FROM session WHERE (sess::jsonb->>'userId') = $1 AND (sess::jsonb->>'_avs') IS NOT NULL AND expire > NOW() ORDER BY expire DESC LIMIT 1`,
    [req.userId]
  );
  // parse and validate _avs timestamp...
}
```
Keep this in sync with `otp-status` Tier 4 (server/routes.ts ~line 5860).
