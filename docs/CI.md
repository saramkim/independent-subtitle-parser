# Hosted CI evidence

The public workflow is [CI](https://github.com/saramkim/independent-subtitle-parser/actions/workflows/ci.yml).
It validates the source checkout and an installed tarball; it never publishes to
npm. Use the run associated with the commit you are evaluating, rather than
assuming an older green result covers later changes.

## First complete public run

[Run 40086044932](https://github.com/saramkim/independent-subtitle-parser/actions/runs/40086044932)
passed all nine jobs for commit
[`61ece9f308858618584b8ad692ade0f61e66a42d`](https://github.com/saramkim/independent-subtitle-parser/commit/61ece9f308858618584b8ad692ade0f61e66a42d).
Each job's downloaded validation report records a clean checkout, unchanged
inputs, **412 passed / 0 failed** tests, and all five validation stages passing.

| Runner | Architecture | Actual Node versions |
| --- | --- | --- |
| Windows | x64 | 20.20.2, 22.23.4, 24.22.1 |
| Ubuntu | x64 | 20.20.2, 22.23.3, 24.21.0 |
| macOS | arm64 | 20.20.2, 22.23.4, 24.22.1 |

The workflow selects supported major versions, so patch versions can differ
between runner images and runs. Every job above records the same source
fingerprint:

```text
e82c3b36d98fb7a62f0be4b180a51bb6a7a11a3e71799bb4fb848782e2552ab8
```

That fingerprint belongs to the cited commit, before this evidence document was
added. Later documentation commits have different source/package hashes and
receive their own CI runs. The workflow page and README badge show current status.

## What the workflow checks

- Locked development install without lifecycle scripts, TypeScript build and tests.
- Real tarball installation with ESM/CommonJS dynamic import, TypeScript
  NodeNext/Bundler declarations, runnable Node example and documentation recipes.
- Installed documentation links, strict package contents, MIT/third-party notices,
  zero runtime dependencies, archive/source/installed byte identity and repeat-pack.
- Node example and a routine benchmark; tracked files must remain unchanged.

Each job uploads its validation logs and candidate tarball as a GitHub Actions
artifact with 14-day retention. Download reports before expiry when preserving
release evidence. Artifacts from this workflow retain `private: true` while the
package is an unpublished candidate; passing CI does not grant publication rights.

## What it does not check

The workflow does not run native browsers, the long mutation campaign, optional
local-only real-file acquisition or the full comparative performance matrix.
The Windows Chromium result is separate local evidence. Firefox/Safari and
Linux/macOS browser behavior remain unverified for the current runtime.
No full ASS rendering, universal recovery or memory bound follows from green CI.
