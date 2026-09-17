---
name: Supabase Storage on Plesk
description: Distinguishes Plesk environment visibility failures from Supabase bucket and policy failures.
---

The payment-image upload route checks for a valid `SUPABASE_URL` and a non-empty `SUPABASE_SERVICE_ROLE_KEY` before it contacts the Storage API. The message that Supabase Storage is not configured therefore indicates a Plesk Node-process environment or deployment-version problem, not a missing bucket policy.

**Why:** Creating the `uploads` bucket cannot change a false configuration check; bucket permissions are only evaluated after the client is initialized and an upload request is sent.

**How to apply:** Check the variables under the Plesk Node.js application environment, verify the startup file and deployed `dist` are current, save/restart the app, and inspect logs for the missing-variable warning. Use a public `uploads` bucket for payment links; the service-role client does not require an upload RLS policy.