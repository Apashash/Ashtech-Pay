---
name: Plesk dist build and commit
description: Build and commit the Plesk distribution alongside related project changes when requested
---

When the user requests `build commit dist` for this project, rebuild the production output and commit `dist/` with the source changes that produced it in the same commit. Do not create an empty commit when the build output is unchanged.

**Why:** the project deploys its tracked build output to Plesk, and the user has repeated this build-and-commit instruction.

**How to apply:** after relevant code changes, run the project production build, inspect the resulting diff, stage the related source plus `dist/`, and commit together.