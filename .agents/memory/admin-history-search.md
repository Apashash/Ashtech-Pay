---
name: Admin transaction history search
description: Search and retention behavior for admin transaction history pages.
---

Admin transaction history searches must run on the server before pagination,
not filter only the rows currently displayed in the browser. Phone searches
must accept the international form with or without `+` and the local digit
form; compare digit strings while ignoring formatting characters.

Transaction history is intentionally retained for 30 days and then deleted
definitively. Search should cover all records still retained, but must not
change or bypass the 30-day cleanup policy.

**Why:** Client-side filtering misses older records on later pages, while
changing retention to support search would conflict with the product's explicit
data-deletion policy.

**How to apply:** Include search terms in the admin transactions API query and
query key. Keep the cleanup scheduler's 30-day cutoff unchanged.