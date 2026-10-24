# Independent Subtitle Parser

Read **SRT, WebVTT, SAMI/SMI and ASS/SSA** with one TypeScript API in browsers and
Node.js. No runtime dependencies, DOM, storage, network access or renderer inside
the library. It preserves source text and reports recovery and unsupported data.

**0.1.6 is an unpublished local candidate.** The owner selected this package name
and the [MIT license](LICENSE). `private: true` still prevents publication;
an actual release requires separate authorization.

## Install this candidate

Use the supplied local tarball, not the public npm registry:

```sh
npm install /absolute/path/to/independent-subtitle-parser-0.1.6.tgz
```

Node.js 20+; ESM with TypeScript declarations. CommonJS callers can use
`await import('independent-subtitle-parser')`; synchronous `require()` is not supported.
Browser consumers need ES2022, and `TextDecoder` when decoding bytes.

## Parse text

```ts
import { parse } from 'independent-subtitle-parser';

const result = parse('1\n00:00:01,250 --> 00:00:03,000\n안녕하세요\nHello');
if (result.status === 'fatal') {
  console.error(result.diagnostics); // no cues are returned
} else {
  console.log(result.cues[0]?.text); // 안녕하세요\nHello
  console.log(result.cues[0]?.start); // 1250 milliseconds
  console.log(result.diagnostics); // inspect partial results too
}
```

- `ok`: no warning/error in the supported extraction profile; not full conformance.
- `partial`: usable data may exist alongside recovery, omitted data or unsupported
  presentation. Inspect diagnostic codes; do not automatically discard the result.
- `fatal`: no cues/tracks/metadata; retain diagnostics and source for inspection.
- `end: null`: the input provides no reliable end. Keep it unknown until your
  application has an explicit playback policy. Do not replace it with zero.

`text` is readable text; `rawText` retains cue markup; `sourceText` is the exact
string passed to `parse`. Render as text, never `innerHTML`. No sorting,
deduplication, language guessing or subtitle rendering happens automatically.

## Read bytes from a file

Decoding and parsing are separate. `decode` defaults to UTF-8 or a UTF-8/UTF-16
BOM; it does **not** detect legacy encodings. On invalid bytes it returns
`text: null`. Supply the encoding you know, such as `euc-kr`.

```ts
import { decode, parse } from 'independent-subtitle-parser';

function readSubtitle(bytes: Uint8Array) {
  const decoded = decode(bytes); // or { encoding: 'euc-kr' }
  const parsed = decoded.text === null ? null : parse(decoded.text);
  return {
    encoding: decoded.encoding,
    decodeDiagnostics: decoded.diagnostics,
    parsed,
    diagnostics: [
      ...decoded.diagnostics.map(d => ({ ...d, stage: 'decode' as const })),
      ...(parsed?.diagnostics ?? []).map(d => ({ ...d, stage: 'parse' as const })),
    ],
  };
}
// Browser: readSubtitle(new Uint8Array(await file.arrayBuffer()))
// Node: readSubtitle(await readFile(path)) from node:fs/promises
```

Check file size **before** reading it. The examples below enforce a 16 MiB file
limit; parser budgets also apply to the decoded string. Keep the original bytes
if byte-perfect archival matters. Replacement decoding (`fatal: false`) must be
an explicit choice and its warning must not be lost even when parsing is `ok`.

## Try a real file

The tarball includes runnable consumer examples. Paths below assume npm installed
the package in this project's `node_modules`.

```sh
# All stages and the full result are written as JSON to stdout.
node node_modules/independent-subtitle-parser/examples/node.mjs ./movie.srt
node node_modules/independent-subtitle-parser/examples/node.mjs ./movie.smi euc-kr sami

# Serve the interactive browser example locally. Open the printed URL.
node node_modules/independent-subtitle-parser/examples/serve.mjs
```

The browser example offers file, encoding and format selection, per-track cue
preview, diagnostics, raw/source previews and full-result JSON download. It runs
file reading and parsing in a disposable module Worker with cancel and a
10-second example deadline. File contents are not uploaded or stored. Preview
limits are labeled and do not truncate the retained result. Track lists use
100-item pages with shortened labels; every track remains selectable. Source order and
unknown end times stay intact. Serve over HTTP; opening the HTML as `file:` will
not reliably load modules/workers.

For a source checkout, run `npm ci --ignore-scripts` and `npm run build`, then
`node examples/node.mjs` or `node examples/serve.mjs`. No-argument Node execution
uses a small built-in SRT. [More recipes](docs/USAGE.md) cover track selection,
Worker lifetime, CLI exits, bundlers and CommonJS.

## Choose format and handle problems

`parse(text, { format: 'sami' })` explicitly selects a parser. Use `sami` for `.smi`
files. Without `format`, detection uses content, not the filename. Ambiguous or
unknown content fails with a diagnostic; do not retry formats until something
looks successful. `detectFormat(text)` exposes candidates and confidence.

[Diagnostic guide](docs/DIAGNOSTICS.md) explains decoding failures, recovery,
omitted cues, presentation limits and resource budgets. File-content problems
return diagnostics; invalid API options throw `TypeError` or `RangeError`.
Catch host I/O/Worker errors separately.

## Reference and scope

- [API, types, resource budgets and format support](docs/API.md)
- [Usage recipes and runnable examples](docs/USAGE.md)
- [Diagnostics and recovery decisions](docs/DIAGNOSTICS.md)
- [Changes](CHANGELOG.md), [design](docs/DESIGN.md), [public sources](docs/SOURCES.md)
- [Corpus and comparison methodology](docs/CORPUS.md), [quality gates](docs/QUALITY.md)
- [Development and local evidence](docs/DEVELOPMENT.md), [third-party notices](THIRD_PARTY_NOTICES.md)
- [Publication preparation and remaining gates](docs/RELEASE.md)

Full ASS rendering, serialization, streaming and automatic charset guessing are
outside the current scope. The API is synchronous and whole-document; host
Workers/processes provide cancellation. Large structured results and JSON export
still consume memory. This candidate is not a claim of universal correctness or
superiority over other parsers. The two Chinese damaged SRT cases and real
ASS/SSA/SAMI corpus gaps remain documented in the quality evidence.
