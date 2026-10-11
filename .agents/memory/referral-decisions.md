---
name: Referral pricing boundaries
description: Safety rationale for provider-cost pricing, caps, timestamp precision and overlapping referral benefits.
---
Referral discounts must not guess an unknown processing cost or increase a customer's normal fee. Do not substitute a default provider fee solely to make a promotion apply.

**Why:** The agreed reward is a temporary reduction, not cash. A fabricated provider cost could turn a nominal margin into a loss; “−50 %” is not a universal mathematical consequence of cost + 0.3 %.

**How to apply:** Price only operations with a configured processing cost, preserve a cheaper normal tariff, and explain the actual formula instead of promising a fixed reduction.

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
