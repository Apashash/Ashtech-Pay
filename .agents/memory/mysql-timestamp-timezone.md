---
name: MySQL timestamp timezone
description: The app's MySQL TIMESTAMP values need a UTC database session and explicit Africa/Douala display conversion.
---

MySQL sessions must use UTC for TIMESTAMP reads and writes; user-facing dashboard dates should explicitly format the instant in the user's device timezone, with a country-based fallback.

**Why:** A Plesk/MySQL server using its local timezone can make notifications appear hours ahead of the actual event when the server and browser interpret TIMESTAMP values differently.

**How to apply:** Keep the database/session pool timezone at UTC, read the browser's IANA timezone with `Intl.DateTimeFormat().resolvedOptions().timeZone`, and use the account country only as a fallback when the device timezone is unavailable.