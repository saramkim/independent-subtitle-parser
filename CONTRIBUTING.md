# Contributing

Contributions can improve parsing, independent test expectations, documentation
or consumer examples. Keep changes focused on the documented extraction profile.
Please explain the input that fails and the behavior your change establishes.

The canonical repository is
[saramkim/independent-subtitle-parser](https://github.com/saramkim/independent-subtitle-parser).
Use [Issues](https://github.com/saramkim/independent-subtitle-parser/issues) for
reports and proposals. Fork the repository, make a focused branch, then open a
[pull request](https://github.com/saramkim/independent-subtitle-parser/pulls)
against `main`. See [Reporting bugs](docs/REPORTING.md). No response time is promised.

## Set up a source checkout

Use Node.js 20+ and npm. Package validation also uses `tar` from PATH.
Runtime dependencies remain empty; TypeScript is a development dependency.

```sh
npm ci --ignore-scripts
npm run build
npm test
```

For a focused change, build and run the relevant test file first:

```sh
npm run build
node --test test/sami.test.mjs
```

Before proposing a finished patch, run `npm run validate`. It builds the package,
runs the suite, installs/checks the real tarball, runs the Node example and records
a benchmark. Evidence is written to a fresh ignored directory. See the
[development guide](docs/DEVELOPMENT.md) for custom output paths and PowerShell.
Do not label an unexecuted platform/browser check as passed. For documentation
changes, validate changed examples and package links; unrelated long fuzz
campaigns need not be rerun when their runtime inputs are unchanged.

## Establish the expected result independently

- Cite a public format specification or a clearly described compatibility policy.
  For real files, record provenance, encoding, revision and SHA-256.
- Add the smallest useful reproduction. Preserve the original failing case and
  show that the proposed fix changes it for the stated reason.
- Do not change an expected value merely because this parser or another library
  returns something else. Explain disagreements and distinguish parsing from
  rendering, raw preservation from text projection, and recovery from conformance.
- Test important effects on times, line breaks, raw/source text, tracks, fields,
  diagnostics and resource limits. Include malformed variants when relevant.

Tests are in `test/`; runtime code is in `src/`; examples are host applications
in `examples/`. The public API is the package root. Keep the core independent of
UI, DOM, filesystem, storage and extension APIs. Full ASS rendering, streaming
and serialization are outside the current scope. Discuss substantial API or
dependency changes with maintainers before investing in a large patch.

## Fixtures, privacy and licensing

Prefer a small synthetic subtitle that you wrote. Do not commit private captions,
full copyrighted transcripts, credentials, local account paths or personal data.
An open-source repository's code license does not necessarily license subtitles,
fonts or images stored beside its code. Third-party fixtures need a verified
redistribution basis, attribution and provenance; retain their original licenses.
If rights are unclear, use a synthetic reproduction or record public provenance
for optional local evaluation. See [corpus methodology](docs/CORPUS.md).

Preserve fixture bytes, BOM and line endings. `.gitattributes` intentionally
disables automatic newline conversion. Do not bulk-format corpus files.
Keep generated `dist/`, tarballs, dependencies, caches and local `evidence/` out
of commits. Original code contributions are provided under the project's
[MIT license](LICENSE); retain applicable third-party notices.

## Submit a focused change

Describe the problem, independent expected behavior, final change and checks
actually run. Mention API/diagnostic changes and known limitations. Update the
changelog and user-facing documentation when behavior changes. Use the prepared
PR template when opening a pull request. Publishing a package or
changing release credentials is a separate maintainer action, not a contribution
requirement. Be respectful and keep disagreements tied to reproducible evidence.
