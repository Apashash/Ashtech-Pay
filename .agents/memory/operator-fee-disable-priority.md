---
name: Operator fee disable priority
description: The admin fee toggle is an operational disable for the associated operator.
---

An operator-specific fee marked inactive must block that operator before any country-level or global fee fallback is considered. Apply the same rule to operator listings and server-side payment initiation paths.

**Why:** The admin's `Actif` toggle is intended to remove the operator from deposit, withdrawal, transfer, and payment-link flows; an active fallback fee must not re-enable it.

**How to apply:** When adding or changing an operator configuration or payment route, load the operator-specific fee state and fail closed on an inactive record rather than relying on client-side filtering.