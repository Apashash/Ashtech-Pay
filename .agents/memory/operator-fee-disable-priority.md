---
name: Operator fee disable priority
description: The admin fee toggle is an operational disable for the associated operator.
---

An operator-specific fee marked inactive must block that operator for its own transaction type before any country-level or global fee fallback is considered. Deposit, withdrawal, and transfer toggles are independent; apply the scoped rule to operator listings, `/v1/countries`, `/v1/fees`, and server-side initiation paths.

**Why:** The admin's `Actif` toggle is intended to remove the operator only from the selected operation. A deposit disable must not unexpectedly remove the same operator from withdrawal or transfer.

**How to apply:** When adding or changing an operator configuration or payment route, compare both `operatorId` and `transactionType`, and fail closed on an inactive record rather than relying on client-side filtering. Rejected stale requests should use the `OPERATOR_DISABLED_BY_ADMIN` code and explain that the administrator disabled the operator.