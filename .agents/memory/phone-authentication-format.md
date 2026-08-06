---
name: Phone authentication format
description: Durable convention for storing and looking up user phone numbers across registration and login.
---

User phone authentication uses the digits-only international representation: the active country dial code followed by the local number.

**Why:** Registration and login must resolve the same account regardless of whether a user enters spaces, dashes, or a leading plus sign; active-country selection also prevents removed countries from being offered.

**How to apply:** Build the identifier from the selected active country's dial code in the client, normalize incoming server values by removing non-digits, and make lookups tolerant of legacy stored formatting.