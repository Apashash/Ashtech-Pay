---
name: AshTech hosted skill installer
description: The public AI integration Skill is hosted at the documentation root and installed with the skills CLI.
---

The canonical integration Skills are served remotely from
`https://doc.ashtechpay.com/skill.md` and the
`/.well-known/skills/index.json` catalogue. Documentation pages should show
short installers such as `npx skills add https://doc.ashtechpay.com --all`
instead of duplicating the full Skill text.

**Why:** Developers want one copyable command that stays synchronized with the
server and installs future AshTech Pay Skills, similar to the Supabase pattern.

**How to apply:** Keep the complete source in the repository root `skill.md`,
publish specialized Skills through the well-known catalogue, include Mobile
Money and crypto rules, and use `--skill <name>` for a focused installation.