---
name: Private KYC storage on Plesk
description: KYC documents are stored outside the public webroot and served only through authenticated application routes.
---

The Plesk KYC storage model is a filesystem directory outside `httpdocs`, with per-user folders, restrictive permissions, and server-generated PDF summaries. New uploads use a private temporary inbox before submission; the final paths are stored in `kyc_submissions` and exposed only to authorized administrators through the application.

**Why:** KYC documents contain identity data and must not be reachable through predictable static URLs or a public Supabase bucket.

**How to apply:** Configure `PRIVATE_DOCUMENTS_ROOT` to an absolute directory outside every public document root. If `privatedoc.ashtechpay.com` points to the same Node app, route requests through the authenticated app and never set its document root to the private directory. Migrate and delete legacy public `kyc/` objects before considering the cutover complete.

**Additional rule:** Never create upload or private-document directories at backend module import time; directory initialization must be non-fatal and upload attempts must report storage permissions explicitly.

**Why:** Plesk may make the application root or its parent non-writable even when the Node process and database environment are valid. A top-level `mkdir` then prevents every route from registering and appears as a generic Passenger bootstrap failure.

**How to apply:** Prefer an absolute writable `UPLOADS_DIR`/`PRIVATE_DOCUMENTS_ROOT` outside the deployment tree, but keep startup alive when those paths are unavailable so public pages and unrelated APIs remain usable.