---
name: KYC update notification flow
description: Mobile KYC update requests use the official-message detail screen before opening the resubmission form.
---

KYC update requests should open the same detail surface as official global messages, carrying the notification ID, then use a dedicated CTA to open the KYC resubmission flow. Query-only navigation must trigger an immediate render: Wouter's `useLocation()` tracks the pathname, while `useSearch()` subscribes to search-string changes.

**Why:** Wouter's location hook exposes only the pathname. Changing only a query parameter can update the URL without rerendering the page, so the detail appears only after a refresh unless the search string is observed directly.

**How to apply:** Read changing query parameters with Wouter's `useSearch()` and retain `window.location.search` as a fallback where needed on mobile. Keep KYC update notifications distinct from broadcast global messages.