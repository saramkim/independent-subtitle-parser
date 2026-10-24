# Release preparation

This checklist is for maintainers of `independent-subtitle-parser`. The current
0.1.7 candidate is unpublished and retains `private: true`. Local preparation
and successful validation are not registry publication or hosted CI results.

## Readiness snapshot

| Area | State |
| --- | --- |
| Runtime and API | 0.1.7 extraction profile documented; latest bounded results in CORPUS-017.md |
| Public documentation | README, contribution/reporting guides, MIT license and third-party notices included |
| Repository participation | Bug report form and PR template prepared locally; not deployed to GitHub |
| Package verification | Actual tarball install, imports, declarations, examples, local document links, byte identity and reproducible packing |
| Source repository and reporting endpoints | Not configured; no repository/homepage/bugs URLs invented |
| Hosted CI | Nine Node 20/22/24 × Windows/Linux/macOS jobs prepared; NOT RUN |
| Current browser matrix | Windows Chromium 156 tested; Firefox/Safari and other OS combinations not revalidated for 0.1.7 |
| Registry and account | Availability, maintainer identity and publishing permissions must be verified at release time |
| Publication | Not authorized or performed as part of preparation; private:true remains |

A public repository/reporting destination and hosted CI are remaining release
steps, not silently waived checks. No new parser feature is implied by these
remaining steps. A first 0.x release must describe its tested scope rather than
claim complete subtitle or renderer conformance.

## Validate a private candidate

```sh
npm ci --ignore-scripts
npm run validate
```

The runner builds, tests, installs the real tarball in an isolated consumer,
runs the Node example and records a benchmark in a new `evidence/` directory.
In PowerShell, use `npm.cmd run validate -- --output evidence/<new-directory>`
when the npm.ps1 wrapper consumes `--`. Existing frozen evidence is never overwritten.

`npm run check:package` checks ESM and CommonJS dynamic import, TypeScript
NodeNext/Bundler declarations, README/usage recipes and all installed Markdown
file links. Every tar entry is compared with source and installed bytes; npm
SHA-1/SHA-512 metadata, the file allowlist, zero runtime dependencies and
repeat-pack identity are checked. It requires `private: true`.

The tarball includes runtime JS/declarations, examples, README, CONTRIBUTING,
documentation, changelog, MIT license and third-party notices. It excludes test
sources, corpora, research dependencies, GitHub templates, local evidence and
credentials. The full source checkout contains the independent test/research
harnesses and redistributable fixtures.

## Before an authorized public release

1. Obtain authorization for the intended public repository/owner and remote
   creation or push. Publish the reviewed source and set verified `repository`,
   `homepage` and `bugs.url` package metadata. Link the canonical issue/PR routes
   in README, CONTRIBUTING and REPORTING; remove their temporary destination
   notices. Confirm whether private vulnerability reporting is available before
   advertising it. Do not invent an email address or response SLA.
2. Run the prepared hosted CI matrix on the exact source revision. Resolve
   failures and record any deliberately unsupported environment explicitly.
   Check the issue form and PR template on GitHub; local schema inspection is
   not hosted UI validation. Check source and documentation links on the npm
   preview/page as well as in the installed package.
3. Select the version and release channel. Recheck the npm name/version,
   maintainer identity, permissions and current authentication requirements.
   Availability is not a reservation. Retain accurate pre-release/0.x messaging.
4. Prepare the public manifest by removing `private: true` only for the authorized
   release candidate. Change README's installation section to the real registry
   command `npm install independent-subtitle-parser` and remove the unpublished
   candidate notice in that release revision. Do not advertise the registry
   installation while it is unavailable.
5. Run `npm run validate` again. It automatically selects `check:release` for a
   public manifest. `npm run check:release` can also be run directly: it requires
   a public manifest plus HTTPS repository/homepage/bug URLs, then runs the same
   tarball consumer checks. It never publishes. URL syntax checks cannot prove
   remote ownership, reachability or account permissions.
6. Record the exact source commit, validation fingerprint, tarball hash and
   included files. Test the installed artifact in the browser. Obtain the
   owner's explicit publication approval for that artifact/version. Only then
   perform the separately authorized publish action and verify the registry
   artifact and README afterwards. Do not claim provenance without a configured
   and verified build/publishing system.

Current preparation does not change npm authentication, create a remote, push,
publish, deploy or integrate either product. Removing `private`, changing
metadata or editing docs changes package bytes: old tarball hashes do not apply.

## Evidence and additional checks

See [quality criteria](QUALITY.md), [API contract](API.md), [consumer recipes](USAGE.md),
[corpus methodology](CORPUS.md) and [latest research reproduction](CORPUS-017.md).
Run optional corpus acquisition explicitly; normal tests do not download samples.
Unclear redistribution rights keep a raw sample out of Git/npm.

After `check:package` or `check:release`, its log identifies the installed consumer.
Run `node scripts/browser-consumer-test.mjs <installed-package-directory> evidence/<new-browser.json>`
and open the printed loopback URL. The harness serves installed assets and saves
results with the tested tarball hash; use a separate report/port for each browser.
Browser examples require HTTP/module Workers, beyond the core library's ESM API.

Historical fuzzing or browser results are not automatically evidence for a new
runtime. Reuse requires recorded file hashes establishing identical relevant
runtime inputs and an explicit description of which evidence is reused. Rebuild
and check every new package artifact. Do not describe the 0.1.5 Firefox result as
0.1.7 validation. Unexecuted environments are NOT RUN, not passes.

Performance samples and mutation/property fuzzing are bounded observations, not
coverage-guided fuzzing, hard RSS guarantees or proofs of completeness. Full ASS
rendering, exact serialization and streaming remain outside the API.
