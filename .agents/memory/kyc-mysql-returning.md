---
name: MySQL KYC update readback
description: KYC reviews must persist the dossier first, then read back the latest submission and both account-level flags.
---

KYC approval and rejection must persist the review status first, then derive the
account-level state from the latest submission and read back both `kycStatus` and
`isVerified`. Admin edits from user-management screens must also update the
latest dossier; otherwise profile reconciliation can reactivate an old approved
submission. A rejected submission must explicitly clear `isVerified`. Updating
the account before the dossier creates a race where a concurrent profile request
can restore the old state.

**Why:** The user profile reconciles account flags from the latest submission.
Writing the dossier first prevents that reconciliation from observing an old
approval while a rejection is still being saved.

**How to apply:** Map admin account statuses to dossier statuses where one
exists, persist the dossier first, then synchronize both account fields. Keep
`not_submitted` as an explicit account override rather than promoting from an
older approved dossier. Use MySQL update-then-readback for MySQL/MariaDB and
`.returning()` only for PostgreSQL.