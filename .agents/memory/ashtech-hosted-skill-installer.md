---
name: AshTech hosted skill installer
description: The public AI integration Skill is hosted at the documentation root and installed with the skills CLI.
---

The canonical integration Skill is served remotely as
`https://doc.ashtechpay.com/skill.md`. Documentation pages should show the
short installer `npx skills add https://doc.ashtechpay.com --all` instead of
duplicating the full Skill text.

**Why:** Developers want one copyable command that stays synchronized with the
server and installs future AshTech Pay Skills, similar to the Supabase pattern.

**How to apply:** Keep the complete source in the repository root `skill.md`,
include Mobile Money and crypto rules there, and use `--skill ashtech` when only
the primary Skill should be installed.