---
name: Four-device session limit
description: AshTech Pay allows no more than four active devices per user.
---

Enforce a maximum of four active devices per account. When a fifth device is saved, disconnect and remove the oldest device; revoke its exact Bearer token before deleting its session row. Apply the limit to existing authenticated sessions too, not only newly created tokens.

**Why:** The user explicitly requires a four-device maximum and automatic oldest-device removal when a new device signs in.

**How to apply:** Keep device identity based on user ID plus signed token issuance time where available; safely evict legacy cookie sessions by their session ID.
