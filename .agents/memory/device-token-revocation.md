---
name: Persistent device-token revocation
description: Revoking a device backed by a stateless Bearer token must survive process restarts without invalidating other devices.
---

Revoking one Bearer-authenticated device requires a durable marker keyed by both user ID and the token's signed issuance timestamp. Deleting its Express session row alone is insufficient because a still-valid stateless token can recreate that row.

**Why:** The token verifier does not require a pre-existing session row, and its in-memory per-token revocation set is lost on restart. A user-wide token cutoff would also revoke every older device rather than only the selected one.

**How to apply:** Persist exact device-token revocations in a dialect-compatible store, check them during Bearer authentication, and expire the markers when the signed tokens themselves can no longer be valid.