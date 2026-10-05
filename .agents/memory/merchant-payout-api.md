---
name: Merchant payout API requirements
description: User requirements for API payout identity, country wallets, and automated USDT withdrawals.
---

For merchant API payouts, require an explicit `user_id` in the request and compare it to the AshTech profile identified by the Bearer API key. Reject missing or mismatched IDs; never let this field select another account or replace API-key authentication.

Mobile Money payouts use the wallet currency mapped to the selected destination country and must not silently convert funds from another wallet. If that specific wallet lacks funds, reject before submitting to a payout provider.

The Direct API payout scope should include automated USDT withdrawals as a separate flow: debit the authenticated profile's USDT wallet, validate the active asset/network and destination address/memo, apply configured USDT fees and limits, and reconcile the asynchronous provider result.

**Why:** The user requires an explicit profile ID even though the API key identifies the account, country-specific wallet debits for fiat payouts, and automated USDT payouts from the Direct API.

**How to apply:** Keep Bearer-key ownership authoritative; require exact equality with `user_id`. For fiat, resolve the destination-country wallet and do not FX-convert. For USDT, reuse the existing crypto payout and IziChange reconciliation path without mixing it into Mobile Money fields.
