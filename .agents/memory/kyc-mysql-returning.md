---
name: MySQL KYC update readback
description: KYC reviews must persist the dossier first, then read back the latest submission and both account-level flags.
---

KYC approval and rejection must persist the review status first, then derive the
account-level state from the latest submission and read back both `kycStatus` and
`isVerified`. A rejected submission must explicitly clear `isVerified`; changing
only `kycStatus` leaves the account flagged as verified. Updating the account
before the submission also creates a race where a concurrent profile request can
restore the old state.

**Why:** The user profile reconciles account flags from the latest submission.
Writing the dossier first prevents that reconciliation from observing an old
approval while a rejection is still being saved.

**How to apply:** Use the MySQL update-then-readback helper for MySQL/MariaDB and
`.returning()` only for PostgreSQL. Sort latest submissions by creation time,
then review/update time; verify both account fields after syncing.