---
name: MySQL crypto-address foreign key compatibility
description: Plesk MySQL's imported users schema may reject the saved crypto-address table's physical user foreign key.
---

For the saved crypto withdrawal-address table in MySQL, keep `user_id` indexed but do not require a physical foreign key to `users.id`. The Plesk-imported users schema rejected the FK as incorrectly formed, while account deletion already removes saved addresses explicitly.

**Why:** The production MySQL schema is imported independently from the active Drizzle schema, so matching application-level identifiers do not guarantee compatible FK type, collation, or engine definitions.

**How to apply:** When changing this table or preparing its Plesk migration, preserve the `user_id` index and the explicit child-row cleanup in account deletion. Revisit the FK only after the production `users` schema is confirmed compatible.