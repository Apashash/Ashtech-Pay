---
name: PawaPay callback access
description: PawaPay callback authentication expectations and safe fallback controls
---

PawaPay's documented v2 callback contract requires a publicly reachable POST endpoint and does not include AshTechPay's locally stored webhook secret. Do not make that secret mandatory for normal callbacks. Validate the provider UUID, apply idempotent state transitions, and support an explicit token only when the callback URL/proxy is configured to send one.

**Why:** Requiring an internal secret that PawaPay never sends turns every legitimate callback into an unauthorized request, while PawaPay's callback delivery retries for a limited period.

**How to apply:** Keep callback routes outside regular user authentication. Use the provider-controlled UUID as the lookup key, acknowledge unknown/replayed callbacks safely, and only enforce a callback token or signature when the upstream delivery mechanism is actually configured and confirmed.