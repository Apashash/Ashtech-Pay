---
name: Private KYC storage on Plesk
description: KYC documents are stored outside the public webroot and served only through authenticated application routes.
---

The Plesk KYC storage model is a filesystem directory outside `httpdocs`, with per-user folders, restrictive permissions, and server-generated PDF summaries. New uploads use a private temporary inbox before submission; the final paths are stored in `kyc_submissions` and exposed only to authorized administrators through the application.

**Why:** KYC documents contain identity data and must not be reachable through predictable static URLs or a public Supabase bucket.

**How to apply:** Configure `PRIVATE_DOCUMENTS_ROOT` to an absolute directory outside every public document root. If `privatedoc.ashtechpay.com` points to the same Node app, route requests through the authenticated app and never set its document root to the private directory. Migrate and delete legacy public `kyc/` objects before considering the cutover complete.