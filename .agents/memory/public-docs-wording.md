---
name: Public documentation wording
description: Documentation rule for describing payment flows without provider references.
---

Public documentation must not name payment providers or refer to them generically. Describe configuration, payment confirmation, and status transitions in neutral terms. Keep exact API property names unchanged when they are part of the published contract.

**Why:** the user explicitly chose to remove generic provider mentions throughout the documentation, not only company names.

**How to apply:** before editing `docs/`, search prose for provider terms and equivalents, then reformulate. Do not rename literal API fields such as `provider_fee_percent`.
