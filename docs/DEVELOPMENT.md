# Development and local evidence

Start with [CONTRIBUTING.md](../CONTRIBUTING.md) for patch and fixture expectations
and [Reporting bugs](REPORTING.md) for minimal reproductions.

The current [ASS/SSA/SAMI corpus workflow](CORPUS-017.md) includes optional local
downloads, independent oracles, comparison and expanded fuzzing. Local transcripts
stay excluded from Git/npm. `scripts/validate.mjs` fingerprints the new research
scripts as well as the runtime, tests and public corpus.

These instructions apply to a source checkout. npm consumers should start with
the [README](../README.md); test sources and evidence are not in the tarball.

```sh
npm ci --ignore-scripts
npm test
npm run check:package
npm run bench
node examples/node.mjs
node examples/serve.mjs
```

`npm run check:package` packs and installs a local tarball into an isolated
consumer, checks ESM/CommonJS dynamic imports, TypeScript NodeNext/Bundler
resolution and included examples. It compares actual tar entries, installed files
and source bytes, and checks repeated pack reproducibility. This check requires
`tar` on PATH (included in modern Windows, Linux and macOS). It does not publish.
The package stays private pending separate publication authorization. The owner
selected MIT for original code. The third-party data has its own
notices; those do not license the author's code.

`npm run validate -- --output evidence/<new-directory>` writes a fresh evidence
directory and rejects overwrites. In PowerShell use `npm.cmd` if the `npm.ps1`
wrapper consumes the argument separator. Validation records hashes, tests, build,
package checks, the Node example and a routine benchmark. In a Git checkout it
also records HEAD and initial dirty state; archives report Git as unavailable.
Validation selects `check:package` for a private candidate and `check:release`
for a public manifest. Both install/test the real tarball; the release check
requires public repository/homepage/bug URLs but does not publish or contact a
registry to prove those URLs or account permissions. See [release gates](RELEASE.md).
A prior run's performance
numbers, browser observations and fuzz campaign are not automatically new proof.

The original 0.1.0/0.1.1 implementation did not inspect either product's source.
The subsequent authorized read-only comparison did inspect WebSubtitle and Play
Plus; no product implementation was incorporated. Product comparison, old quality
records and original archives stay unchanged. No adapters or product edits were
made during this usability iteration.

Local records (not tarball paths):

- `evidence/phase-1/REPORT.md` — initial implementation.
- `evidence/improvements-1/REPORT.md` — 0.1.1 improvements.
- `evidence/product-comparison-1/` — historical product comparison.
- `evidence/quality-012-final/REPORT.md` — 0.1.2.
- `evidence/quality-013-final/REPORT.md` — 0.1.3 corpus, six OSS comparisons,
  Node20/24/Chromium, performance/memory and the 15-minute mutation campaign.
- `evidence/usability-014-final/REPORT.md` — 0.1.4 consumer examples and Pro review.
- `evidence/release-015-final/REPORT.md` — 0.1.5 packaging, Firefox, expanded corpus
  and the one-hour mutation campaign.
- `evidence/corpus-016-final/REPORT.md` — 0.1.6 corpus and parser improvements.
- `evidence/corpus-017-final/REPORT.md` — 0.1.7 runtime, real large ASS/SSA and
  legacy SAMI command validation; subsequent documentation packaging has its own record.

These historical records are local archives, not files delivered by Git clone.
Fresh runs recreate evidence from the tracked tests and research harnesses.

## Git and continuous integration

Git history starts with the verified 0.1.5 source baseline. Earlier versions are
local snapshots, not reconstructed commits. Source, tests, documentation, lockfiles,
licensed corpus and independent research harnesses are tracked. Generated dist,
tarballs, local evidence, caches and historical product-comparison copies are not.
The original archives remain unchanged. Git does not provide an off-device backup
unless those commits have been pushed. The canonical `origin` is
`https://github.com/saramkim/independent-subtitle-parser.git`; ignored local
evidence and caches are not backed up by pushing the repository.

`.gitattributes` disables automatic newline conversion for exact byte retention,
including mixed-newline/BOM fixtures checked against upstream hashes. Preserve
those fixtures as-is; do not run bulk formatters over the corpus.

`.github/workflows/ci.yml` prepares nine validation jobs: Node 20, 22 and 24 on
Windows, Ubuntu and macOS. Each installs the root lockfile without lifecycle
scripts, then runs the same `npm run validate` command and checks tracked files
for changes. Action revisions are pinned, repository permissions are read-only,
and no npm publication or deployment step is present. Logs and candidate tarballs
are retained for 14 days when the workflow runs on GitHub.

The workflow runs in the public repository; the first complete nine-job hosted
matrix is recorded in [CI evidence](CI.md). Check the run for the commit you use.
It does not automate native-browser tests,
the one-hour fuzz campaign or the full comparative performance matrix. Routine
benchmarks are observations, not timing thresholds on shared CI machines.

Use focused commits for later changes. Connect a release's source commit, fresh
validation fingerprint and exact package hash; create a release tag only when the
actual candidate is selected. Keep `private: true` until publication is explicitly
authorized. See [publication preparation](RELEASE.md).

See [corpus methodology](CORPUS.md) for reproduction and licenses, and
[quality gates](QUALITY.md) for remaining limitations. The library still has no
runtime parser dependencies. An example UI or local server is consumer code,
not a new DOM/filesystem/network dependency of the package root export.
