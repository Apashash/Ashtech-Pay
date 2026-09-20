---
name: Operator fee availability
description: The admin fee toggle marks the associated operator temporarily unavailable for one operation.
---

An operator-specific fee marked inactive must keep that operator and its country visible, but expose the operator as temporarily unavailable and prevent selection. It must block initiation for its own transaction type before any country-level or global fee fallback is considered. Deposit, withdrawal, and transfer toggles are independent.

**Why:** Users and API merchants must still see that the country and operator are supported, while understanding that the operator is temporarily unavailable. A deposit disable must not unexpectedly affect withdrawal or transfer.

**How to apply:** In catalog/config responses, return the operator with an unavailable status. Disable it in the UI with an explicit “Indisponible” label. On every initiation path, fail closed with `OPERATOR_DISABLED_BY_ADMIN` and a temporary-unavailability message.