---
name: Crypto memo and QR handling
description: Rules for preserving destination memos/tags across crypto catalogues, payment flows, and QR codes.
---

Crypto destination data has two independent values: `address` and `memo`/`tag`. They must be returned, displayed, copied, and stored separately.

**Why:** Concatenating a memo into an address or generating a QR with duplicate `data` parameters can cause wallets to ignore the destination tag and make deposits unattributable.

**How to apply:** Infer memo requirements for XRP, XLM, TON-family networks when the provider omits flags; reject a provider response missing a required memo; use a chain-specific URI only when its format is known, otherwise put the address alone in the QR and keep the memo visible separately.