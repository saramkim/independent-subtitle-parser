# API reference

## Public contract

Only the package root is public. See the emitted TypeScript declarations for full
types. Times are **nonnegative safe integer milliseconds**, never seconds.

| API | Result / behavior |
| --- | --- |
| `parse(text, { format?, limits? })` | `ParseResult`, content errors reported as diagnostics. Options choose `srt`, `vtt`, `sami`, `ass`, `ssa`; `.smi` maps to the `sami` option. |
| `detectFormat(text)` | `{ format, confidence, candidates }`; bounded content heuristic, no filename guessing. |
| `decode(bytes, { encoding?, fatal?, maxBytes? })` | `{ text, encoding, bom, diagnostics }`; text is `null` on fatal decoding failure. |
| `DEFAULT_LIMITS` | Frozen default parsing budgets. |

`ParseResult` contains:

- `format`, `status`, `cues`, `tracks`, `metadata`, `diagnostics`, `diagnosticsTruncated`.
- `sourceText`: the **exact input string**, including original BOM and line endings.
- Each cue: `start`, `end`, `trackId`, `text`, `rawText`, one-based inclusive
  `source: { line, endLine }`; optional `id`, `settings`, ordered `fields`.
- `end: null` means no reliable end exists. Consumers must choose their own playback
  policy. Do not coerce it to zero or silently add a duration.
- `text` is a reading projection. `rawText` preserves markup with normalized LF
  line endings. WebVTT also replaces NUL with U+FFFD during parsing; `sourceText`
  retains the original NUL. Neither value is safe HTML.
- Tracks expose `id` and available `language`, `label`, `kind`, `sourceClass`.
  ASS styles and speakers are event fields, not invented language tracks.
- Ordered `{ name, value }` fields retain duplicates and names such as
  `__proto__` as data. Metadata preserves non-cue format blocks. Source line
  ranges aid inspection; character offsets and round-trip serialization are absent.

Cues retain source order, duplicates, overlaps and authored Unicode. There is no
automatic sorting, deduplication, Unicode normalization or language guessing.
Source/raw fields are the preservation layer; the reading projection is not a
complete semantic AST or a faithful layout representation.

## Detection, decoding and errors

Detection examines at most **65,536 UTF-16 code units**. WEBVTT/SAMI signatures,
ASS/SSA headers and comma SRT timings provide signals. Partial ASS/SAMI fragments
can give low confidence and a warning. Headerless dot timings are ambiguous
between SRT recovery and headerless VTT: auto mode fails; supply the known format.
Explicit VTT still requires `WEBVTT`. Embedded signature-like text, long preambles
and conflicting dialects can defeat heuristics; use explicit format when known.

`decode` uses the platform WHATWG `TextDecoder`; it does not guess charset from
language or retry encodings until one appears to work. BOM and an explicit label
must agree. Unsupported labels, UTF-32 BOMs, or malformed bytes are fatal by
default. `fatal: false` explicitly permits U+FFFD replacement with a warning.
Legacy encodings such as EUC-KR/Windows-1252 depend on runtime decoder support.
Windows-1252 C1 output is corrected to the WHATWG mapping on affected Node/ICU
versions; this narrow correction is not a replacement implementation of all
legacy decoders. The full byte range and aliases are tested on Node 20 and 24.
WebVTT bytes are specified as UTF-8; the generic decoder does not enforce the
format's encoding policy. A host accepting legacy VTT is making that choice.
Byte-perfect archival requires the caller to keep the original bytes; decoding
consumes the BOM and is separate from exact *string* preservation in `parse`.

| Status / severity | Meaning |
| --- | --- |
| `ok` | No warning/error/fatal occurred in this supported extraction profile. Not a full-format conformance certificate. |
| `partial` | Warning/error: recovered syntax, omitted invalid cues, unsupported settings, uncertain timing or another disclosed issue. Inspect diagnostics. |
| `fatal` | No usable parse selected, invalid signature, unsupported SAMI time unit, or a budget exceeded. Returns **no cues/tracks/metadata**, while retaining source and fatal reason. |
| `info` | Deliberate projection limits (e.g. ASS rendering) or explicit unknown end. Does not alone make status partial; repeated info codes coalesce. |
| `warning` / `error` | Recovery or rejected data; later valid cues may still be returned. |

Diagnostics have stable string codes, severity, explanatory message and an optional
source line. Wrong input types, unknown parse formats and invalid numeric budgets
throw `TypeError` or `RangeError`. An unsupported encoding label instead returns
a decode diagnostic with `text: null`;
unexpected implementation failures are not hidden as a successful empty parse.
Diagnostic truncation is explicit through `diagnosticsTruncated`. Higher-severity
causes take priority within the cap; ties retain earlier messages and output stays
in encounter order. A terminal fatal reason survives. Repeated info-code coalescing
does not count as truncation. Truncation itself makes status `partial`, including
overflow consisting only of distinct informational messages. **Migration from 0.1.0:** check this boolean instead
of looking for the synthetic `DIAGNOSTICS_TRUNCATED` diagnostic, which is no longer
emitted. This avoids sacrificing the actual error when the budget is one.

## Supported profiles and limits

| Format | Parsed and preserved | Deliberate limits / recovery |
| --- | --- | --- |
| SRT | Integer ms timing, numeric IDs, multiline payload/spaces, basic `b/i/u/s/font/br` reading projection, HTML character references, raw markup, trailing timing settings. | SRT has no universal normative grammar. Missing/nonnumeric index, short hour, dot fraction, single-dash arrow and one terminal period after a complete comma end clock recover with warnings. Invalid clock components/unsafe/reversed times are skipped. Missing blank separators recover at timing-shaped lines; an actual timing-shaped sentence is inherently ambiguous. Detached payload after blank lines is not guessed back into a cue. No layout or coordinate execution. |
| WebVTT | Signature, long-hour or mm:ss timestamps, IDs, overlap/order, settings, NOTE/STYLE/REGION/header blocks, text markup/classes/voice/language/ruby/inline times, HTML character references per the 2026 specification. | Caption-oriented text projection, not the full browser parser/DOM/rendering algorithm. Tags and annotation boundaries remain in rawText/fields; ruby text is flattened. Unknown tags remain literal with warnings. No complete nesting/CSS/region validation, stylesheet application, or chapter/metadata schema validation. HLS `X-TIMESTAMP-MAP` is preserved and warns; times remain local. |
| SAMI/SMI | Case-insensitive structural tags, quoted/unquoted attrs, optional closes, SYNC millisecond times, class language tracks, simple CSS `Name/lang/SAMIType`, BR/PRE, character refs, ordered paragraph attributes, Source ID text/fields, clear events. | A class updates only itself; absent classes stay active. Truly empty SYNC closes all active classes (historical Microsoft guidance). Final/ambiguous end is null. Physical whitespace has an HTML-like reading projection; no full HTML/CSS parser/cascade/layout. Class values are case-sensitive and multi-token Class is a separate track with warning. No persistent Source panel emulation. Images are never loaded; alt text only. Non-ms declared Metrics/TimeStamp units fail. |
| ASS/SSA | ASS v4+, SSA v4, centisecond times, declared event columns (Text last), embedded commas, dialogue, comment/style/script/opaque metadata, speaker/style/effect fields, raw overrides and drawings, `\N`, `\n`, `\h`, simple top-level `\q/\p/\r`. | **No ASS renderer**: no fonts, styles, karaoke animation, drawing, positioning or effect execution. Drawing commands are excluded from reading text, retained raw. `\n` depends on WrapStyle/q; Banner implies wrap 2. Custom Format is a libass extension; nonfinal Text/duplicate time columns are rejected. Missing Format assumes canonical known-version columns with warning. Component 60 is normalized with warning following libass guidance; unsafe times are rejected. Unknown versions require usable explicit Format. |

WebVTT timing also accepts section 6.3 parser recoveries (compact arrows, a single
hour digit, ASCII form feed, and adjacent end/settings) with `VTT_TIMING_RECOVERED`.
This does not certify valid authoring syntax. Invalid clock ranges/fraction lengths
remain rejected. Duplicate IDs and serialized `line:auto` are diagnosed without
renaming or dropping otherwise usable cues. U+2028/U+2029 remain ordinary input
characters, not CR/LF line separators.

ASS bare `\p` exits drawing mode, and bare `\q` restores script WrapStyle.
Escaped braces use the documented **libass extension** with an info diagnostic;
this differs from some other renderers. The existing `\r` extraction policy resets
wrap/drawing state; when this affects text it warns `ASS_RESET_APPROXIMATION`, since
libass behavior differs. No renderer equivalence is promised; raw payload remains.

Character references use a generated WHATWG data table, decoded once. Unknown
references remain literal; invalid numeric scalar values use U+FFFD. This is
distinct from Unicode normalization. The HTML-like reading projections are not
HTML conformance implementations. Full text provenance remains available.

Legacy ASS/SSA `Timer` clock scaling is **not applied**. Non-100 or invalid Timer
values produce `ASS_TIMER_UNAPPLIED`; returned timestamps are literal event times,
not a claim of legacy playback alignment. Conflicting selected format and known
`ScriptType` produce `ASS_SCRIPT_TYPE_MISMATCH`; declared column mapping is retained.

## Resource and security model

Since 0.1.6, SAMI CSS `SAMI_Type` is recognized alongside `SAMIType`. Source ID
paragraphs warn once per document with `SAMI_SOURCE_ID_UNAPPLIED`: their text and
fields survive, but persistent speaker state is not modeled. ASS one-digit
minute/second fields recover with `ASS_TIME_WIDTH_RECOVERED`; fractional precision
remains exactly two digits. See [corpus adjudication](CORPUS-016.md).

| Budget | Default |
| --- | ---: |
| `maxInputLength` | 8,388,608 UTF-16 code units |
| `maxLines` | 250,000 |
| `maxLineLength` | 1,048,576 UTF-16 code units |
| `maxCues` | 100,000 |
| `maxDiagnostics` | 1,000 |
| `decode.maxBytes` | 16,777,216 bytes |

Limits must be positive safe integers and may be lowered by the host. Length/line
limits are checked before line-array allocation. Whole documents, raw data and
cue/field arrays are materialized; this is **not streaming or zero-copy**. Dense
markup and many metadata fields amplify memory beyond file size. Large untrusted
documents should use tighter budgets and a host-managed worker with a deadline.
The library does not start a worker, cancel work, fetch external entities/fonts,
evaluate expressions or execute embedded script/CSS. Treat every output as
untrusted text; use `textContent`/framework text binding, never raw `innerHTML`.

Forward scanners and bounded detection avoid the reproduced regular-expression
backtracking and selector-by-declaration cross-product issues. Tests include
isolated hostile inputs, diagnostic exhaustion, malformed Unicode bytes,
prototype-like field names, 400 deterministic mutations, and large timelines.
These checks are a focused engineering review, not proof against every hostile
file or an exhaustive security audit.

