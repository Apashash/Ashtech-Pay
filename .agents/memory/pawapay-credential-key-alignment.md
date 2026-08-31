---
name: PawaPay credential key alignment
description: Why encrypted PawaPay settings can appear configured but remain unusable at runtime
---

New PawaPay credentials use a dedicated envelope derived from the stable server session secret, while the reader keeps a compatibility fallback for older values encrypted with `FIELD_ENCRYPTION_KEY`.

**Why:** PawaPay administration should not require a second deployment-only key, but the credentials must remain encrypted and existing installations must not lose access to legacy ciphertext.

**How to apply:** Use the admin page to save or replace PawaPay credentials. Keep `SESSION_SECRET` stable across workers; do not store a master key in `platform_settings`. Legacy values can be read and are migrated when a safe PawaPay key is available.