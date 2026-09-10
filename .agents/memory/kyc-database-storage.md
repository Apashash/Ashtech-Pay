---
name: Encrypted KYC database storage
description: KYC uploads use encrypted database storage when filesystem permissions are unavailable on Plesk.
---

KYC uploads are stored as encrypted records in the database instead of relying on a writable private filesystem directory. The authenticated image proxy and admin routes remain the only document access path, while legacy filesystem paths remain readable for migration compatibility.

**Why:** The Plesk subscription did not provide SSH or administrator access, so Linux ownership of the private document directory could not be corrected safely.

**How to apply:** Keep `FIELD_ENCRYPTION_KEY` stable across deployments. On MySQL, the application creates the document table during startup; deploy the compiled bundle and restart before testing uploads. Telegram KYC notifications must read these encrypted records server-side and upload multipart files directly; never expose public document URLs.