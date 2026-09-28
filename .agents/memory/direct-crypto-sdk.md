---
name: Direct crypto SDK
description: Contract and compatibility decisions for exposing crypto pay-ins through the merchant Direct API.
---

The Direct API exposes crypto pay-ins through dedicated `/v1/crypto/assets` and `/v1/crypto/collect` endpoints, while `/v1/collect` remains Mobile Money-only and unchanged.

**Why:** Keeping crypto on a separate route prevents changes to existing operator, OTP, Wave, and Mobile Money integrations while allowing the same `ak_…` merchant authentication.

**How to apply:** Keep crypto-only fields conditional in transaction status and webhook payloads; use the administrator's USDT/XAF rate and combined Ashtech/provider crypto fees; filter disabled asset networks server-side.

## IziChange pay-in status references

Use IziChange's resource ID (`externalReference` or the provider's payment-intent ID) to resolve signed pay-in webhooks first. When the webhook also includes an AshTech merchant reference, both lookups must identify the same transaction. Keep the merchant-reference fallback for older or racing events; do not invent a GET status endpoint unless IziChange documents one.

**Why:** The current IziChange pay-in integration is webhook-driven, and the signed event may arrive before the provider ID readback is saved. Matching a known provider ID improves reconciliation without breaking those valid timing and compatibility cases.

**How to apply:** Extract the nested payment resource ID before envelope IDs, verify reference matches before settlement, and keep client-facing references AshTech-generated. Add active polling only after confirming the official read endpoint and its ID semantics.