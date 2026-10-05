---
name: AfribaPay documentation drift
description: Current AfribaPay callback signature contract and conflicting PAYIN limits.
---

The current public Postman collection specifies HMAC-SHA256 over the exact raw request body in `AfribaPAY-Sign`, using the API key/password. It does not specify timestamp-prefixed input; keep timestamp-prefixed verification only as compatibility for explicitly timestamped legacy callbacks. AfribaPay has published different PAYIN maximums, so enforce the lower 2,000,000 ceiling until confirmed.

**Why:** A current public callback example now provides a concrete raw-body signature contract, while the PAYIN limit remains conflicting. The stricter PAYIN cap avoids sending amounts that another published limit rejects.

**How to apply:** Verify the public collection before changing signature behavior; sign the untouched raw body and compare in constant time. Revisit the PAYIN cap only when AfribaPay confirms the production limit for the account, then update validation and tests together.