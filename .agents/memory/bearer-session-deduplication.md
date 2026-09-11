---
name: Bearer session deduplication
description: Cookie-less Bearer requests can create fresh Express SIDs; durable session writes must be keyed by the signed token timestamp.
---

Cookie-less Bearer authentication can create a new Express session ID on every request. Treat `userId + tokenIssuedAt` as the durable device identity, route writes for that pair into one session row, and deduplicate legacy rows when listing devices.

**Why:** Mobile browsers may retain the local Bearer token while dropping the session cookie, which otherwise makes every API request appear as a new device and can make “disconnect other devices” delete the current device.

**How to apply:** Preserve existing verified admin factors when an ordinary ephemeral request rewrites the canonical row, identify the current Bearer device by token timestamp during bulk logout, and keep the session list deduplicated by token timestamp.