---
name: Mintlify local branding
description: Why documentation branding assets must be hosted by Mintlify rather than linked from the main site
---

Mintlify branding assets should be local files referenced from `docs.json`, not remote images served by the AshTech Pay application.

**Why:** The main site sends `Cross-Origin-Resource-Policy: same-origin`; browsers such as Samsung Internet block those images when Mintlify loads them from `doc.ashtechpay.com`, leaving the image alt text visible.

**How to apply:** Keep the docs logo and favicon as self-contained assets in the documentation repository and run a Mintlify manual update after pushing changes.