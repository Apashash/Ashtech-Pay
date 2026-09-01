---
name: PawaPay credential key alignment
description: Why encrypted PawaPay settings can appear configured but remain unusable at runtime
---

New PawaPay credentials use a dedicated envelope. The key priority is an optional
stable `PAWAPAY_CREDENTIAL_ENCRYPTION_KEY`, then `FIELD_ENCRYPTION_KEY`, then the
database connection secret, then the stable `SESSION_SECRET`; readers try all
configured keys for compatibility.

**Why:** Plesk can route requests across workers with different session secrets;
the database connection secret is already shared by the application workers, so
it provides a stable fallback without requiring a new Plesk variable.

**How to apply:** Prefer a dedicated stable PawaPay key when available. Otherwise
the existing database connection or field key is used automatically. Keep the
chosen key stable across workers. Do not store a master key in
`platform_settings`; re-save an unreadable credential once so it is migrated to
the current envelope.