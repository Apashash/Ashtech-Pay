---
name: KYC guard trigger pgBouncer bug
description: PostgreSQL BEFORE UPDATE trigger blocking is_verified on pgBouncer poolers; root cause and fix.
---

## The Rule
The `ashtech_guard_sensitive` trigger on `users` must NOT block `is_verified` — only `is_banned` and `role`.

**Why:** The trigger checks `current_setting('application_name')` to verify the connection comes from the app pool (`ashtech_secure_app`). Supabase Supavisor and pgBouncer in transaction mode reset `application_name` between transactions, so legitimate app updates would fail with `RAISE EXCEPTION`. This caused KYC approval to 500 in production even though the DB pool correctly sets `application_name` in the connection string URL.

**How to apply:** When adding new "sensitive" columns to the guard trigger, only add columns where DB-level protection is truly needed (e.g., privilege escalation: `is_banned`, `role`). Columns updated by authenticated admin flows (like `is_verified` via KYC) should NOT be in the trigger — the application-layer auth (TOTP + PIN + admin role) is sufficient protection.

## Files changed
- `server/index.ts` — trigger DDL updated to remove `is_verified`
- `server/storage.ts` — `approveKycSubmission` wraps `updateUser` in try/catch with fallback to kycStatus-only update
