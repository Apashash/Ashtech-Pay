---
name: Admin OTP security hardening
description: Security fixes applied to admin OTP flow, Telegram webhook, and banner endpoint. Documents decisions future work must stay consistent with.
---

## Rules

**OTP in session (VULN-A1):** Never store plaintext OTP in `req.session`. Store `_otpCodeH = hashOtp(code)` (HMAC-SHA256 keyed by SESSION_SECRET). In-memory `adminOtpStore` keeps plaintext — it is never written to DB. Verify by comparing `hashOtp(submitted)` vs `_otpCodeH`; use `storedIsHashed` flag to route comparison correctly.

**Why:** Anyone with read access to the PostgreSQL session table could extract the OTP and bypass admin 2FA.

**OTP store key (VULN-A5):** `adminOtpStore` is keyed by `req.sessionID`, not `req.userId`. Periodic TTL eviction runs in the existing 10-min setInterval. Cleanup always deletes both `_otpCode` (legacy) and `_otpCodeH`.

**Why:** userId-keyed store shares state across concurrent admin sessions; sessionID isolation prevents one session invalidating another's code.

**OTP request throttle (VULN-A2):** `checkAdminOtpRequestLimit` / `recordAdminOtpRequest` — in-memory per-userId throttle (3 req / 15 min), applied **inside the route handler after role check**, NOT as IP-based middleware.

**Why:** IP-based middleware (`adminOtpRequestLimiter` on rateLimiter.ts) was removed because NAT-sharing users could exhaust the IP budget and lock admins out.

**Telegram webhook secret (VULN-A3):** `getTelegramWebhookSecret()` in `telegram.ts` derives a 64-char hex secret from `HMAC-SHA256(SESSION_SECRET, "tg-webhook-secret-v1")`. Falls back to a **process-local random** (`_DEV_WEBHOOK_SECRET`) — never a hardcoded constant. `setWebhook` passes `secret_token`; handler rejects (acks but skips) any request missing or mismatching `X-Telegram-Bot-Api-Secret-Token`.

**Why:** Without signature verification, anyone who discovers the webhook URL can inject fake Telegram updates.

**Banner endpoint (VULN-A4):** `VALID_BANNER_TYPES` Set (18 values matching `BannerType` in bannerGenerator.ts) + `bannerLimiter` (10 req/min/IP). Invalid type → 400 before sharp is invoked.

**Supabase SSL:** `sslConfig` in `server/db.ts` sets `rejectUnauthorized: false` for `pooler.supabase.com` hostnames (self-signed cert chain). All other external hosts still use `rejectUnauthorized: true`.
