---
name: Mobile crypto tester layout
description: Responsive constraints for the crypto API tester on narrow mobile browsers.
---

On narrow mobile screens, form controls below 16px can trigger iOS Safari page zoom. Long crypto addresses, memo values, and JSON responses can also exceed grid/flex minimum widths and hide content on the right.

**Why:** Mobile screenshots showed the tester appearing zoomed and its right side clipped, making fields and API response details inaccessible.

**How to apply:** Use a mobile-only 16px font size for inputs/selects, add `min-w-0` to grid/flex columns and fields, constrain response blocks to `max-w-full`, wrap long JSON/addresses, and keep the page/header width fluid with centered max-width containers.