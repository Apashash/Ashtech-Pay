# Locally patched braces

This is the MIT-licensed `micromatch/braces` 3.0.3 source with a local fix
for GHSA-vfj7-8cjw-p6xm (CVE-2026-93687). No upstream fixed release was
available when this patch was made.

Parsing rejects brace/parenthesis nesting beyond 64 levels with a controlled
`SyntaxError`. The compile, expand, and stringify entry points also validate
caller-supplied ASTs iteratively before recursive traversal, rejecting excessive
depth and cycles. The limit cannot be disabled by caller options.
Normal brace syntax and the upstream range limits remain unchanged.

The package is named `@ashtech/braces` to distinguish this maintained fork from
the vulnerable upstream release, not to imply that upstream 3.0.3 is fixed.
Root npm/pnpm overrides and the preview project's npm override replace every
transitive `braces` dependency with this local package.

Run `npm run test:braces` from the project root to verify the patch and the
installed dependency resolutions. Once upstream publishes a verified fix,
replace the local overrides and rerun these regression tests.
