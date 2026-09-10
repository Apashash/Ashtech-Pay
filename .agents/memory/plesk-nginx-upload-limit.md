---
name: Plesk Nginx upload limit
description: Reverse-proxy request limits can reject KYC multipart uploads before the Node application receives them.
---

Plesk/Nginx may enforce a request body limit around 2 MB even when the Node/Multer route allows 5 MB. A KYC image above that threshold returns an HTML `413 Request Entity Too Large` directly from Nginx, so the application cannot log or handle the upload.

**Why:** A real production request reproduced `413` for a 2.65 MB image, while smaller unauthenticated requests reached the Node application. This makes the client’s nominal 5 MB limit misleading on Plesk.

**How to apply:** Keep KYC images below the proxy threshold through client-side JPEG compression with multipart overhead room, or explicitly raise the Plesk Nginx `client_max_body_size` and retest through the public domain.