---
name: Merchant API identity and wallet requirements
description: User requirements for user_id validation, merchant-visible balances, conversions, and payouts.
---

For every merchant Direct API operation, require an explicit `user_id` and compare it to the AshTech profile identified by the Bearer API key. Reject missing or mismatched IDs; never let this field select another account or replace API-key authentication. This applies to balance reads, conversions, and payouts.

The merchant API should let platforms display the authenticated profile's AshTechPay wallet balances, including country-specific wallet currencies. Return the wallet currency and balance clearly; never expose another profile's balances.

Mobile Money payouts use the wallet currency mapped to the selected destination country and must not silently convert funds from another wallet. If that specific wallet lacks funds, reject before submitting to a payout provider. Conversions targeting a country must resolve that country's exact internal wallet currency server-side.

Keep `GET /v1/countries` default behavior deposit-focused and backward-compatible. Merchant payout integrations should request `operation=payout` to get transfer-enabled countries, withdrawal operators, and the informational `wallet_currency` value. The payout request itself still selects the wallet only through `country_code`.

**Why:** Deposit and withdrawal availability are configured independently; reusing the deposit catalog for payouts can hide valid destinations or show the wrong operators. Keeping the default unchanged protects existing merchant integrations.

**How to apply:** Use `/v1/countries?operation=payout` to populate Mobile Money payout forms. Never treat `wallet_currency` as a payout input or infer payout availability from the default deposit response.

Create a Direct payout debit and its transaction in one database transaction; do the same for a conversion debit, conversion request, and transaction. Conditional balance updates must prevent concurrent requests from overdrawing a wallet. Refund only on a definitive provider rejection; timeouts and ambiguous outcomes remain pending for reconciliation.

**Why:** A partial write could lose the transaction record for money already debited, while a timeout cannot prove that the payout provider did not send the funds.

**How to apply:** Use one storage transaction for the debit plus all records needed to reconcile it. Preserve idempotency references and keep uncertain payouts pending until an authoritative result arrives.

The Direct API payout scope should include automated USDT withdrawals as a separate flow: debit the authenticated profile's USDT wallet, validate the active asset/network and destination address/memo, apply configured USDT fees and limits, and reconcile the asynchronous provider result.

**Why:** The user requires `user_id` on all merchant API operations, wants merchants to display AshTechPay balances inside their own platforms, and requires country-specific wallets and automated USDT payouts.

**How to apply:** Keep Bearer-key ownership authoritative; require exact equality with `user_id` on balance, conversion, and payout requests. For fiat, resolve the destination-country wallet and do not silently FX-convert payouts. For USDT, reuse the existing crypto payout and IziChange reconciliation path without mixing it into Mobile Money fields.
