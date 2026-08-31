---
name: PawaPay MSISDN formatting
description: Country-aware phone formatting required by PawaPay v2
---

PawaPay v2 deposit and payout requests require `phoneNumber` in international MSISDN format, starting with the selected country's dial code. Local input such as `683677872` for Cameroon must be sent as `237683677872`.

**Why:** PawaPay rejects a valid-looking local number with `INVALID_PAYER_FORMAT` when its country prefix is missing.

**How to apply:** Normalize the number at the PawaPay request boundary using the operation country, while leaving the user's stored phone value unchanged. Use the same rule for deposits, payouts, and hosted Payment Pages.