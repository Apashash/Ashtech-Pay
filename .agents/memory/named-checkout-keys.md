---
name: Named checkout keys
description: Checkout API keys are user-named and stored separately while legacy hosted keys remain compatible.
---

Keep additional Checkout credentials and their success/cancel/webhook URLs in a dedicated per-user key collection. Treat the original hosted-page credential as a legacy key rather than silently replacing it, so existing integrations continue working.

**Why:** Merchants need separate credentials and redirect behavior for different stores or applications, but rotating or migrating the original `hp_live` credential can break a live integration without warning.

**How to apply:** New keys must require a merchant-provided name, inherit the current URLs on creation, support per-key URL editing and independent rotation/deletion, and be included in `hp_live` lookup by hash. Dashboard key management may expose decrypted values only to the authenticated merchant.