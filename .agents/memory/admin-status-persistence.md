---
name: Admin status persistence
description: Reliable success semantics for admin transaction and KYC status changes.
---

Admin success responses must mean the requested state was actually persisted. Transaction changes should compare-and-set against the status originally read so a provider callback or another admin action cannot be overwritten. KYC approval/rejection should confirm both the account KYC fields and submission status after writes. Provider acknowledgments with HTTP 202 mean processing is ongoing, not that the requested terminal state is complete.

**Why:** The UI previously showed generic success for provider reconciliation and asynchronous acknowledgments, while the backend could return a readback whose status did not match the requested status. Cached detail queries could also continue displaying the previous state.

**How to apply:** For admin mutations, validate persisted readbacks before returning success, use conditional updates for state transitions, invalidate the affected list and detail queries, and give 202 responses an explicit in-progress message.