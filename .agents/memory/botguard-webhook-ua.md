---
name: BotGuard blocks payment webhooks
description: Any server-to-server webhook endpoint must be whitelisted in botGuard.ts or short/empty User-Agents from processor servers get 403.
---

## Rule
Every new payment processor webhook path must be added to `API_UA_EXEMPT_PATHS` in `server/botGuard.ts`.

## Why
`botGuard` rejects requests where `User-Agent` is absent or shorter than 10 chars (`res.status(403).json({ message: "Accès refusé." })`). Payment processors (IziChange, Swychr, AfribaPay, etc.) call webhooks from server processes that often send minimal or no User-Agent headers. Without whitelisting, all webhook deliveries fail silently with 403 — IziChange retries twice then marks the webhook `ÉCHEC`.

## How to apply
When adding a new payment processor:
1. Register the webhook route in `routes.ts`.
2. Immediately add its path prefix to `API_UA_EXEMPT_PATHS` in `botGuard.ts`.
3. Current exempt list (as of 2026-07-31): `/api/swychr/webhook`, `/api/afribapay/webhook`, `/api/pixpay/webhook`, `/api/izichange/webhook`, `/api/pay/`, `/api/v1/hosted-payment`, `/api/telegram/webhook`.
