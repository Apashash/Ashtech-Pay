---
name: Referral pricing boundaries
description: Safety rationale for provider-cost pricing, caps, timestamp precision and overlapping referral benefits.
---
Referral discounts must not guess an unknown processing cost or increase a customer's normal fee. Do not substitute a default provider fee solely to make a promotion apply.

**Why:** The agreed reward is a temporary reduction, not cash. A fabricated provider cost could turn a nominal margin into a loss; “−50 %” is not a universal mathematical consequence of cost + 0.3 %.

**How to apply:** Price only operations with a configured processing cost and preserve a cheaper normal tariff. The user explicitly requested “−50 %” promotional copy on the referral page without changing this calculation. Treat that wording as a copy-only choice, not authorization to halve fees; the actual formula does not guarantee that percentage.

Account-wide operation limits and currency-specific volume limits intentionally avoid adding unlike wallet amounts.

**Why:** Country wallets have distinct units and no universal conversion rate was approved for the promotion caps.

**How to apply:** Keep volume ceilings based on configured operation limits per currency; review the commercial limits before changing them.

An independently qualifying new referral renews a five-day window; unused days are not added together. Replaying the same qualification must not renew it.

**Why:** Both accounts should receive five days from the new qualification, without accumulating arbitrarily long promotional periods.

**How to apply:** Keep one current window, tied to a single recorded qualification or audited admin action.

Invitation boundaries must tolerate second-precision legacy transaction timestamps.

**Why:** MySQL can truncate a transaction created just after signup to the start of that second, making a millisecond-precision invitation appear newer and wrongly excluding valid operations.

**How to apply:** Compare at compatible precision. Attribution is established atomically during creation of a new account, so same-second transactions cannot belong to a pre-existing account history.

Referral eligibility is a lifetime signup threshold, not a rolling history-window threshold.

**Why:** A user may complete KYC after the platform has purged old transaction history. That purge must not erase legitimate progress; known failed or refunded transactions must still stop counting.

**How to apply:** Retain minimal eligibility proof separately from the financial history and label unavailable historical details honestly. Do not recreate purged financial records.

Changes to the referral-code format must preserve links already shared by users.

**Why:** The user requested six-character codes for easier sharing after twenty-character codes had already been exposed in production.

**How to apply:** Keep earlier codes usable as aliases, enforce uniqueness for new codes, and preserve existing attribution and promotion periods. Referral codes are public sharing identifiers, not authentication credentials.

The user-facing referral page must follow the existing dashboard's typography and theme, rather than a separate visual identity.

**Why:** The user explicitly asked for the same writing style, theme and colors as the dashboard after seeing the independently styled referral page.

**How to apply:** Use shared dashboard components and semantic light/dark theme colors when extending this page; do not reintroduce an independent green/beige palette.
