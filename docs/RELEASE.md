# Publication preparation

This is the local **0.1.5** candidate for **independent-subtitle-parser**.
The owner selected the package name and MIT license. `private: true` intentionally
prevents accidental publication. No registry publication is authorized.

## Artifact and consumer checks

Run `npm ci --ignore-scripts`, then `npm run validate` from the source checkout.
The validation runner builds, tests, installs the real npm tarball in an isolated
consumer, executes the Node example and records a benchmark. Its output is a new
directory under `evidence/`; existing evidence must not be overwritten.

`npm run check:package` checks ESM and CommonJS dynamic imports, TypeScript
NodeNext/Bundler declarations, documentation recipes and local links. It verifies
every actual tar entry against both source and installed bytes, npm SHA-1/SHA-512
metadata, the file allowlist, zero runtime dependencies and repeat-pack identity.
The tarball contains runtime declarations, examples, documentation, MIT license
and third-party notices. Research dependencies, corpora and local evidence stay
outside the package. Their licenses remain in the source snapshot.

Install the locally built candidate with:

```sh
npm install ./independent-subtitle-parser-0.1.5.tgz
```

This package is ESM-only. CommonJS callers use dynamic `import()`; a synchronous
`require()` export is not promised. The supported Node range starts at 20.
Browser use requires modern ESM and the platform's TextDecoder support; the
optional example additionally requires module Workers and File APIs.

## Reproduce additional research checks

Run from the source checkout, using new output paths. Comparator/bundler tools
are development-only installs; they are not runtime dependencies of the package.

```sh
npm --prefix research/reference-parsers ci --ignore-scripts
npm --prefix research/quality-013 ci --ignore-scripts
npm --prefix research/release-015 ci --ignore-scripts
node research/release-015/compare-upstream.mjs evidence/new-upstream.json
node research/release-015/exports.mjs evidence/new-exports.json
node research/release-015/fuzz.mjs 3600 evidence/new-fuzz
# After fuzzing ends:
node research/quality-013/performance.mjs evidence/new-performance.json
node --expose-gc --max-old-space-size=768 research/quality-013/performance.mjs stress
```

The core comparison and authored format probes are described in [CORPUS.md](CORPUS.md).
After `npm run check:package`, its output identifies a consumer directory and the
installed package inside it. Pass that consumer directory to
`node research/release-015/bundle-consumer.mjs <consumer-directory> evidence/new-bundle.json`.
For actual browser checks, run
`node scripts/browser-consumer-test.mjs <installed-package-directory> evidence/new-browser.json`
and open the printed loopback URL. The harness uses installed package assets and
saves its result to the new report. Use a separate report/server port for another
browser. This is a developer test harness and is not included in the npm tarball.

## Separate publication gate

Before any future publication, obtain the owner's explicit publication request
for a concrete artifact/version, recheck registry name/version availability and
account permissions, and review the current npm authentication requirements.
Removing `private` changes package bytes: rebuild, rerun consumer verification,
and approve that new immutable artifact. A local 404 name lookup is not a name
reservation. Do not invent a repository URL or claim npm provenance without the
corresponding repository/build configuration.

No authentication, publication, remote repository creation, push, deployment or
product integration is part of this preparation. Runtime dependencies remain
empty; development-only comparator packages are not shipped.

## Evidence limits

Consult [quality criteria](QUALITY.md), [corpus methodology](CORPUS.md),
[API contract](API.md) and [consumer recipes](USAGE.md). Local reports record
the exact runtime, platform, input fingerprint and artifact hash of each run.
An unexecuted browser/OS cell is NOT RUN, not a pass. A browser-control tool
failure is not evidence of a parser defect or successful browser compatibility.
Firefox 158.0.1 was acquired from Mozilla and launched in an isolated profile.
Native automation was blocked by the tool's Windows browser URL policy, so the
owner opened the local harness manually; its twelve automated checks passed and
the server saved the result. Chromium 156 passed the same twelve flows, including
205 paged tracks, real module Workers, cancellation and legacy decoding.
Safari/macOS/Linux remain unverified. Each report records its tested tarball hash.
If final documentation changes the archive hash, evidence reuse requires an
explicit file-by-file comparison proving runtime, declarations, examples and
package metadata identical; the new tarball still receives fresh package checks.
These observations are not blanket platform certification.

Current samples do not establish comprehensive ASS/SSA/SAMI production coverage.
Mutation/property fuzzing is not coverage-guided fuzzing, a hard memory bound or
a proof of completeness. Full ASS rendering, exact serialization/roundtrip and
streaming parsing remain outside the declared API.
