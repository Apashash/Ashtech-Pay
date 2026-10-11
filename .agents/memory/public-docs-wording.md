---
name: Public documentation wording
description: Public documentation and public-page rule for describing payment flows without provider references.
---

Public documentation must not name payment providers or refer to them generically. The user also requires checking other user-facing pages and messages for payment-provider mentions, not only the landing page and terms of use. Describe configuration, payment confirmation, and status transitions in neutral terms. Keep exact API property names unchanged when they are part of the published contract.

**Why:** the user explicitly chose to remove generic provider mentions throughout the documentation, not only company names.

**How to apply:** before editing public docs, Skills (`docs/`, `skill.md`, and `.well-known/skills/`), user-facing pages, translations or notification messages, search prose for provider terms and equivalents, then reformulate in both French and English. Preserve internal identifiers, administrator configuration labels and literal API fields such as `provider_fee_percent`. Do not remove necessary data-sharing disclosures; describe recipients neutrally.

The user wants decorative long dashes removed from interface text in this project.

**Why:** The user explicitly asked to remove the dashes appearing throughout the interface after seeing the landing-page API list.

**How to apply:** Use normal sentences, commas or colons in prose. Keep hyphens required in endpoint paths, identifiers, numerical signs and API contracts unchanged.
