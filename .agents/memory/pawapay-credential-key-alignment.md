---
name: PawaPay credential key alignment
description: Why encrypted PawaPay settings can appear configured but remain unusable at runtime
---

New PawaPay credentials use a dedicated envelope. The key priority is an optional
stable `PAWAPAY_CREDENTIAL_ENCRYPTION_KEY`, then `FIELD_ENCRYPTION_KEY`, then the
stable `SESSION_SECRET`; readers try all configured keys for compatibility.

**Why:** Plesk can route requests across workers with different session secrets;
encrypting with the first available stable key prevents a credential saved by one
worker from becoming unreadable on the next request.

**How to apply:** Prefer a dedicated stable PawaPay key when available. Otherwise
keep `FIELD_ENCRYPTION_KEY` or `SESSION_SECRET` stable across workers. Do not
store a master key in `platform_settings`; re-save an unreadable credential once
the deployment has a shared key so it is migrated to the current envelope.