---
name: Auth country detection
description: Country selection behavior for login and registration forms.
---

The login and registration country selectors first use the server-side `/api/public/geo` country code when that country is active, then fall back to the first active country. A manual user selection must never be overwritten by the asynchronous detection result.

**Why:** Users should see the most likely phone prefix without losing control, and removed or unsupported countries must never be auto-selected.

**How to apply:** Wait for the geo query to finish before choosing the automatic country, match only against the active `/api/public/countries` list, and track manual selection separately.