---
name: Payment link social previews
description: Social crawlers receive payment-link metadata from the server-rendered SPA shell.
---

Payment-link sharing metadata must be upserted into the HTML shell, not only replaced, because the compiled SPA may omit image tags entirely.

**Why:** WhatsApp and Facebook inspect the initial HTML response and do not wait for React hydration; replacing absent tags silently produces no product image.

**How to apply:** Keep development and production payment-page handlers on the same metadata helper, with an absolute public image URL and a fallback to the default AshTech Pay metadata when no product image exists.