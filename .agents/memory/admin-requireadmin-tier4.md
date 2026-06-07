---
name: Admin OTP Tier 4 Security Issue
description: Adding Tier 4 (userId search) to requireAdmin or otp-status creates a cross-browser/cross-session OTP bypass. Use Tier 3 (sessionID) with retry instead.
---

## The Rule
Never add a Tier 4 (search by `userId` across all sessions) to `requireAdmin` or `otp-status`. It allows any browser with the same account to bypass OTP entirely.

## The 3 Correct Tiers (requireAdmin and otp-status)
1. In-memory `adminVerifiedSessions` Map (instant, same process)
2. `req.session._avs` timestamp (session middleware, DB-backed)
3. Direct DB query by `sessionID` only — with **one retry (200ms wait)** to handle transient Supabase pool contention under PM2

## Why Tier 4 Is Dangerous
Tier 4 searches the session table by `userId` across ALL active sessions with `_avs` set. If Browser A has verified OTP, Browser B (same user, different session) gets admin access without being asked for OTP. This is a cross-session bypass.

## Root Cause of PM2 Failures
On Plesk with PM2 multi-process + Supabase free tier (25 connection limit):
- Multiple PM2 workers × 2 pools each can exhaust Supabase connections
- Tier 3 sessionPool.query() fails transiently → added 1 retry with 200ms delay
- This is sufficient — same sessionID is always in the cookie, DB lookup finds it when pool is available

## How to Apply
When debugging "admin shows zeros with OTP bypass=false":
1. Check if Tier 3 is failing (look for `[AdminAccess] DB session fallback error` in logs)
2. If yes: it's a pool connection exhaustion issue — reduce PM2_INSTANCES or upgrade Supabase plan
3. NEVER add Tier 4 as a fix — it's a security hole
4. The retry loop in Tier 3 handles transient failures safely
