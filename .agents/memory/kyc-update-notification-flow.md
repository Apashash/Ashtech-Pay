---
name: KYC update notification flow
description: Mobile KYC update requests use the official-message detail screen before opening the resubmission form.
---

KYC update requests should open the same detail surface as official global messages, carrying the notification ID, then use a dedicated CTA to open the KYC resubmission flow.

**Why:** Mobile routing can expose only the pathname through the router hook, so relying only on router-provided query text can leave a verified user on the read-only KYC screen.

**How to apply:** When reading `update=true` or `notificationId`, use the router location when it includes the query and fall back to `window.location.search`; keep KYC update notifications distinct from broadcast global messages.