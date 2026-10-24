# Independent Subtitle Parser

[![CI](https://github.com/saramkim/independent-subtitle-parser/actions/workflows/ci.yml/badge.svg)](https://github.com/saramkim/independent-subtitle-parser/actions/workflows/ci.yml)

Parse **SRT, WebVTT, SAMI/SMI and ASS/SSA** with one TypeScript API in browsers
and Node.js. Extract timed text and language tracks while keeping the source,
raw markup and diagnostics available for inspection.

- **One data model:** millisecond timestamps, readable text, tracks and metadata.
- **Explicit recovery:** malformed input, omitted data and unsupported presentation
  produce diagnostics instead of silently disappearing.
- **Portable core:** no runtime dependencies, DOM, storage, network access or renderer.

Use it for subtitle import, inspection, search and text-based playback workflows.
For styled ASS playback, use a dedicated renderer alongside the preserved source.

## Install

Registry installation (requires a published version):

```sh
npm install independent-subtitle-parser
```

For an unpublished release candidate, install the supplied tarball instead:

```sh
npm install ./independent-subtitle-parser-0.1.7.tgz
```

To build that tarball from a source checkout:

```sh
git clone https://github.com/saramkim/independent-subtitle-parser.git
cd independent-subtitle-parser
npm ci --ignore-scripts
npm pack
```

Node.js **20+**; ESM with TypeScript declarations. CommonJS callers use dynamic
`import()`; synchronous `require()` is not a supported export. Browser consumers
need ES2022, and `TextDecoder` when decoding bytes. Import the package root through
your application's module/bundler setup; the examples also run without a bundler.

## Quick start

```ts
import { parse } from 'independent-subtitle-parser';

const source = '1\n00:00:01,250 --> 00:00:03,000\n안녕하세요\nHello';
const result = parse(source);

if (result.status === 'fatal') {
  console.error(result.diagnostics); // no cues, tracks or metadata returned
} else {
  console.log(result.cues[0]?.start); // 1250 (milliseconds)
  console.log(result.cues[0]?.end);   // 3000
  console.log(result.cues[0]?.text);  // 안녕하세요\nHello
  console.log(result.diagnostics);   // inspect partial results too
}
```

`parse` detects the format from content. If the format is already known, pass
`parse(source, { format: 'sami' })`; `.smi` files use the `sami` option.
`detectFormat(source)` exposes the detection result without parsing cues.

## Supported formats

| Format | Extracted and preserved | Important limits |
| --- | --- | --- |
| SRT | Times, IDs, multiline text and raw markup; diagnosed recovery of common malformed syntax | No universal SRT standard or styling renderer; ambiguous damage can remain unrecovered |
| WebVTT | Times, IDs, cue settings, text/voice/language markup and NOTE/STYLE/REGION metadata | No browser layout/CSS engine; HLS timestamp mapping is retained but not applied |
| SAMI/SMI | SYNC times, class/language tracks, clear events, BR/PRE and legacy authoring-command metadata | Final end can be unknown; no full HTML/CSS layout, Source panel or command execution |
| ASS/SSA | Dialogue, centisecond times, event fields, styles/comments, raw overrides and a reading-text projection | No fonts, positioning, drawings or karaoke rendering; declared Timer scaling is not applied |

See the [complete support profile](docs/API.md) for recovery rules and unsupported
syntax. Source order, overlaps and duplicates are retained. The library does not
sort cues, infer languages, merge tracks or choose a playback track for you.

## Work with results

| Value | Meaning |
| --- | --- |
| `status: 'ok'` | No warning/error in the supported extraction profile; not a full conformance certificate |
| `status: 'partial'` | Usable data may coexist with recovery, omitted data or unsupported presentation; inspect diagnostics |
| `status: 'fatal'` | No cues/tracks/metadata; diagnostics and source remain available |
| `end: null` | No reliable end is known; your application must choose an explicit playback policy |

`text` is a reading projection. `rawText` retains cue markup with LF-normalized
line endings. `sourceText` is the exact string passed to `parse`. Keep original
bytes separately for byte-perfect archival. Render output as text, never raw
`innerHTML`. A warning about unapplied styling does not necessarily mean that a
caption was lost. The [diagnostic guide](docs/DIAGNOSTICS.md) explains decisions.

For multilingual subtitles, inspect `result.tracks`, let the caller choose a
track ID, then filter `result.cues` by `cue.trackId`.
[Track-selection recipes](docs/USAGE.md) cover missing language metadata and
unknown end times.

## Decode file bytes

Decoding is separate from parsing. `decode` defaults to UTF-8 or a UTF-8/UTF-16
BOM; it does **not** guess legacy encodings. Supply a known encoding such as
`euc-kr`. Invalid byte sequences fail by default.

```ts
import { decode, parse } from 'independent-subtitle-parser';

function readSubtitle(bytes: Uint8Array, encoding?: string) {
  const decoded = decode(bytes, { encoding });
  const parsed = decoded.text === null ? null : parse(decoded.text);
  return { decoded, parsed }; // retain diagnostics from both stages
}

// Browser: readSubtitle(new Uint8Array(await file.arrayBuffer()))
// Node: readSubtitle(await readFile(path)) from node:fs/promises
// Legacy encoding: readSubtitle(bytes, 'euc-kr')
```

Check file size **before** reading it. Default decoding accepts up to 16 MiB;
parsing has separate string, line, cue and diagnostic budgets. Replacement
decoding (`fatal: false`) is an explicit lossy choice: retain its warning even
when parsing succeeds. Invalid API options throw `TypeError` or `RangeError`;
file-content problems return diagnostics. Catch host I/O errors separately.

The API is synchronous and reads a whole document. Large results and JSON export
consume memory. For untrusted files or responsive UI, use lower
[resource budgets](docs/API.md) and a host-managed Worker/process with a deadline.

## Try a real file

The package includes runnable examples. From an application with the package
installed:

```sh
node node_modules/independent-subtitle-parser/examples/node.mjs ./movie.srt
node node_modules/independent-subtitle-parser/examples/node.mjs ./movie.smi euc-kr sami
node node_modules/independent-subtitle-parser/examples/serve.mjs
```

The Node example writes the complete result as JSON. The server prints a local
URL for the browser example, which provides file/encoding/format selection,
track previews, diagnostics, JSON download and a cancellable module Worker.
File contents are not uploaded or stored. Preview limits do not truncate the
retained parse result. Serve over HTTP; `file:` does not reliably load modules.

In a source checkout, run `npm run build`, then `node examples/node.mjs` or
`node examples/serve.mjs`. See [consumer recipes](docs/USAGE.md) for CommonJS,
bundlers, Worker lifetime and CLI exit codes.

## Validation and compatibility

[Hosted CI](docs/CI.md) passed **412 tests in each of nine jobs**: Node 20, 22 and
24 on Windows, Ubuntu and macOS. Package checks install the actual tarball and
check imports, TypeScript declarations, examples and archive byte identity.
Local Chromium 156 also passed 16 consumer scenarios on Windows. The Node CI
matrix does not certify native browser behavior: the current runtime has not
been revalidated in Firefox/Safari or in browsers on the other operating systems.

The latest corpus expansion checked 23,889 events in seven real ASS/SSA files
for timing, raw text and fields; reading text was scored on a restricted 5,107
events. Three legacy SAMI files were checked separately. A ten-minute seeded
campaign completed 3,655,680 mutations and 456,960 arithmetic cases, with another
896 mutations on full-size original files. These are bounded checks, not proof
of perfection, full rendering conformance or superiority over every parser.

Reproduce the standard checks in a source checkout with `npm run validate`.
[Corpus methodology](docs/CORPUS.md), [the latest evaluation](docs/CORPUS-017.md)
and [quality criteria](docs/QUALITY.md) explain sources, licenses, comparisons,
unscored cases and reproduction commands. Historical local evidence archives
are not included in Git or npm.

## Contribute and report bugs

Small reproductions, corrections to format interpretation, documentation and
tests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup and expected
evidence, and [Reporting bugs](docs/REPORTING.md) for the report checklist.
Use the [public source repository](https://github.com/saramkim/independent-subtitle-parser),
[bug report form](https://github.com/saramkim/independent-subtitle-parser/issues/new?template=bug_report.yml)
and [pull requests](https://github.com/saramkim/independent-subtitle-parser/pulls).

During 0.x, review the [changelog](CHANGELOG.md) when upgrading and pin the
version you have validated. New diagnostics and recovery behavior can affect
consumer decisions. Full rendering, serialization, streaming and automatic
charset guessing remain outside this package's current scope.

## License and documentation

Original package code is licensed under [MIT](LICENSE). Third-party reference
data retains its own licenses; see [third-party notices](THIRD_PARTY_NOTICES.md).

- [API reference](docs/API.md) and [diagnostic guide](docs/DIAGNOSTICS.md)
- [Usage recipes](docs/USAGE.md) and [development guide](docs/DEVELOPMENT.md)
- [Design](docs/DESIGN.md), [public format sources](docs/SOURCES.md) and [changelog](CHANGELOG.md)
- [Release checklist for maintainers](docs/RELEASE.md)
