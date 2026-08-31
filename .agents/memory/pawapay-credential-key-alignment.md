---
name: PawaPay credential key alignment
description: Why encrypted PawaPay settings can appear configured but remain unusable at runtime
---

Encrypted PawaPay credentials are bound to the exact `FIELD_ENCRYPTION_KEY` used when they were saved. A different key makes the stored token unreadable even when the database row exists and is marked encrypted.

**Why:** Local and Plesk/production processes can use different environment files or secret values while sharing a database, causing decryption authentication failures that look like a missing or inactive PawaPay configuration.

**How to apply:** When PawaPay reports missing configuration or cannot load active configuration, verify key alignment without exposing the token; if the key changed, re-save the credentials through the admin settings using the runtime key rather than copying encrypted values. Treat credential lookup as part of the provider timeout because it happens before the HTTP request.