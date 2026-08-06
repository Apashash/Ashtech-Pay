---
name: Auth country detection
description: Country selection behavior for login and registration forms.
---

The login and registration country selectors use the server-side `/api/public/geo` country code when that country is active, then fall back to the first active country. The endpoint first accepts a trusted proxy country header when available, then performs an IP lookup. A manual user selection must never be overwritten by the asynchronous detection result.

**Why:** Users should see the most likely phone prefix without losing control, and proxy-provided country data avoids an unnecessary external lookup while the IP fallback works on other hosts. Removed or unsupported countries must never be auto-selected.

**How to apply:** Match the server result only against the active `/api/public/countries` list, show a first active country while loading, track manual selection separately, and do not trigger identifier validation merely because the user switches login mode or edits the phone prefix.