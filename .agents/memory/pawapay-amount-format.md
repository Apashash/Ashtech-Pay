---
name: PawaPay amount canonicalization
description: PawaPay v2 amount formatting requirements for internal fixed-point values
---

PawaPay v2 accepts decimal amounts only when the fractional part ends in a non-zero digit. An internal fixed-point representation such as `200.00` must be canonicalized to `200`; `100.50` becomes `100.5`.

**Why:** Formatting route amounts with `toFixed(2)` creates valid-looking values that PawaPay rejects before processing.

**How to apply:** Canonicalize and validate amounts at the shared PawaPay client boundary so direct deposits, payouts, and payment pages all send the same contract-compliant representation.