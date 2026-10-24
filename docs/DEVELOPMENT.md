# Development and local evidence

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
package checks, the Node example and a routine benchmark. A prior run's performance
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

See [corpus methodology](CORPUS.md) for reproduction and licenses, and
[quality gates](QUALITY.md) for remaining limitations. The library still has no
runtime parser dependencies. An example UI or local server is consumer code,
not a new DOM/filesystem/network dependency of the package root export.
