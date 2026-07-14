---
name: AfribaPay OTP-requirement detection must never silently degrade
description: Why Orange/Moov CI (and similar OTP-required operators) could fail with an opaque 502/400 instead of showing the OTP step, and the fix pattern used.
---

AshtechPay's AfribaPay OTP pre-check (`getAfribaPayOtpInfo` in `server/afribapay.ts`) decides whether to show the user an OTP step before calling `/v1/pay/payin`. It depends on a live `/v1/countries` API call and on the operator code we pass matching AfribaPay's own `operator_code` exactly.

Two failure modes both cause the SAME symptom (payment silently fails with AfribaPay's raw "This operation requires an OTP code." error, no OTP UI ever shown, only for operators that actually need OTP — e.g. Orange/Moov in CI — while non-OTP operators like MTN/Wave keep working):
1. The countries-fetch call throwing (auth/network/circuit-breaker) was being swallowed silently and treated as "no operator needs OTP".
2. A caller passing an ad-hoc lowercased operator name (e.g. "orange money") instead of the normalized code AfribaPay expects (e.g. "orange") via `resolveAfribaPayOperatorCode` — one caller (`/v1/collect` public API) did this while the internal deposit/payment-link flows did not.

**Why:** OTP requirement is a payment-blocking gate — if detection under-fires, the user/merchant gets a dead end with no path to complete payment, and it looks like a generic gateway error, not an OTP problem.

**How to apply:** Any OTP-requirement check for AfribaPay must (a) union live API data with a small static table of known OTP-required operator/country pairs (Orange CI/SN/BF/GN, Moov CI/BF) rather than trusting live data alone, (b) log (not swallow) countries-fetch failures, and (c) always resolve the operator code the same way (`resolveAfribaPayOperatorCode`) everywhere it's used. As a last-resort safety net, if AfribaPay's payin call itself rejects with an OTP-required-style message despite our pre-check saying no, treat that as OTP-required reactively instead of failing the transaction (see `isAfribaPayOtpRequiredMessage`).
