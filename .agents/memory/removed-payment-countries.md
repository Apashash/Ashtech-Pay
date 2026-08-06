---
name: Removed payment countries
description: Durable policy for removing unsupported countries and currencies from AshTech Pay.
---

When a country is removed from payment support, delete only its country configuration, operators, fees, and wallets with explicitly confirmed scope. Disable dependent auto-conversion rules and reset affected user currency preferences to the platform default. Preserve historical transactions; do not refund, resubmit, or delete them as part of country removal.

**Why:** Country removal is destructive for configuration and wallet balances, but historical financial records must remain available for audit and the existing retention policy.

**How to apply:** Before deleting, inspect wallets, user preferences, auto-conversion rules, payment-link country restrictions, operators, and fees. Use an atomic database transaction and verify that the removed country codes, wallets, and active rules are gone afterward.