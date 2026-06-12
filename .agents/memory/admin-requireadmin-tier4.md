---
name: Admin OTP requireAdmin — pool exhaustion & PM2_INSTANCES bug
description: Why admin routes return 403 with all zeros on PM2 production, the real root causes, and the correct fixes.
---

## The Rule
Never add a Tier 4 (search by `userId` across all sessions) to `requireAdmin` or `otp-status`. It allows any browser with the same account to bypass OTP entirely (cross-session bypass).

## The 3 Correct Tiers (requireAdmin and otp-status)
1. In-memory `adminVerifiedSessions` Map (instant, same process) — keyed by `sessionID`
2. `req.session._avs` timestamp (session middleware, DB-backed)
3. Direct DB query by `sessionID` only — tries `sessionPool` first (2 attempts, 200ms wait), then falls back to main `pool` if sessionPool is exhausted

## Root Cause 1: NODE_APP_INSTANCE misuse (db.ts)
`NODE_APP_INSTANCE` is the **index** of the current PM2 worker (0, 1, 2, 3...) — NOT the total count.
Using it as the total PM2 instances count gives wrong pool sizes per worker:
- Worker 0: index=0 → parseInt("0")||1 = 1 → SESSION_POOL_MAX=8 (too large)
- Worker 1: index=1 → 1 → SESSION_POOL_MAX=8 (too large)
- Worker 2: index=2 → 2 → SESSION_POOL_MAX=4 (also wrong)

**Fix**: Remove `NODE_APP_INSTANCE` from PM2_INSTANCES calculation. Require explicit `PM2_INSTANCES` env var.
Set `PM2_INSTANCES=4` (or actual count) in the production PM2 ecosystem config.

## Root Cause 2: sessionPool exhaustion under PM2 load
With incorrect pool sizing, all PM2 workers together exhaust DB connections:
- 4 workers × 8 connections = 32 total vs Supabase free tier 25 limit
- Tier 3 sessionPool.query() fails transiently on simultaneous admin requests
- All requests that land on workers without the in-memory cache hit 403

**Fix**: In `requireAdmin` Tier 3, try `sessionPool` first (2 attempts), then fall back to main `pool` if sessionPool throws. Same fix applied to `otp-status` endpoint.

## Production Action Required
Set `PM2_INSTANCES` env var on the production server (ashtechpay.top / Plesk) to match the actual PM2 instance count (e.g., `PM2_INSTANCES=4`). This sizes pools correctly and prevents exhaustion.

## How to Apply
When debugging "admin shows zeros / 403 on all admin routes":
1. Check `[AdminAccess] DB session fallback warn` in logs — confirms pool exhaustion
2. Check if `PM2_INSTANCES` is set on production server
3. If not set: add it to PM2 ecosystem config or .env file
4. The `pool` fallback in Tier 3 should recover the session until PM2_INSTANCES is fixed
5. NEVER add Tier 4 as a fix — it is a cross-session security bypass
