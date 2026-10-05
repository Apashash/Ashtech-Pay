---
name: Merchant API identity and wallet requirements
description: User requirements for user_id validation, merchant-visible balances, conversions, and payouts.
---

For every merchant Direct API operation, require an explicit `user_id` and compare it to the AshTech profile identified by the Bearer API key. Reject missing or mismatched IDs; never let this field select another account or replace API-key authentication. This applies to balance reads, conversions, and payouts.

The merchant API should let platforms display the authenticated profile's AshTechPay wallet balances, including country-specific wallet currencies. Return the wallet currency and balance clearly; never expose another profile's balances.

Mobile Money payouts use the wallet currency mapped to the selected destination country and must not silently convert funds from another wallet. If that specific wallet lacks funds, reject before submitting to a payout provider. Conversions targeting a country must resolve that country's exact internal wallet currency server-side.

The Direct API payout scope should include automated USDT withdrawals as a separate flow: debit the authenticated profile's USDT wallet, validate the active asset/network and destination address/memo, apply configured USDT fees and limits, and reconcile the asynchronous provider result.

**Why:** The user requires `user_id` on all merchant API operations, wants merchants to display AshTechPay balances inside their own platforms, and requires country-specific wallets and automated USDT payouts.

**How to apply:** Keep Bearer-key ownership authoritative; require exact equality with `user_id` on balance, conversion, and payout requests. For fiat, resolve the destination-country wallet and do not silently FX-convert payouts. For USDT, reuse the existing crypto payout and IziChange reconciliation path without mixing it into Mobile Money fields.
