---
name: Direct crypto SDK
description: Contract and compatibility decisions for exposing crypto pay-ins through the merchant Direct API.
---

The Direct API exposes crypto pay-ins through dedicated `/v1/crypto/assets` and `/v1/crypto/collect` endpoints, while `/v1/collect` remains Mobile Money-only and unchanged.

**Why:** Keeping crypto on a separate route prevents changes to existing operator, OTP, Wave, and Mobile Money integrations while allowing the same `ak_…` merchant authentication.

**How to apply:** Keep crypto-only fields conditional in transaction status and webhook payloads; use the administrator's USDT/XAF rate and combined Ashtech/provider crypto fees; filter disabled asset networks server-side.