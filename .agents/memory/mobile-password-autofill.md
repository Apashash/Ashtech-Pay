---
name: Mobile password autofill
description: Autocomplete conventions for the email and phone authentication forms.
---

The account email is the login identifier for password-manager purposes. Registration marks the pseudo as `nickname`, email as `username`, and new passwords as `new-password`; login marks the email as `username` and the password as `current-password`.

**Why:** Mobile password managers can otherwise interpret the registration pseudo as the account identifier and autofill it on the login page instead of the email.

**How to apply:** Preserve these autocomplete semantics when changing the authentication forms. Existing incorrect saved credentials remain on the user's device and must be edited or deleted manually.