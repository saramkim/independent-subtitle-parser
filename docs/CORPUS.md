# Corpus, comparison and robustness methodology

The 0.1.3 work uses external tests as evidence, not as an instruction to copy
another parser's behavior. No WebSubtitle or Play Plus source was changed or
incorporated. No compatibility adapters or public npm publication were performed.

## Acquired corpus and provenance

`corpus/manifest.json` records URLs, byte sizes and SHA-256 for 175 files.
The test suite verifies every recorded byte. Raw upstream files are unchanged.

- **WPT:** WebVTT file-parsing and cue-text-parsing data, generated fixtures and
  supporting test definitions from revision
  `ab209eeecc95915675cde8d26ede4b2d803b4055` of
  [web-platform-tests/wpt](https://github.com/web-platform-tests/wpt/tree/ab209eeecc95915675cde8d26ede4b2d803b4055/webvtt/parsing).
  BSD-3-Clause; original license at `corpus/wpt/LICENSE.md`.
- **Real files:** 24 published SRT subtitle files for *Tears of Steel*, downloaded
  unchanged from the [Blender official directory](https://download.blender.org/demo/movies/ToS/subtitles/).
  Attribution: **(CC) Blender Foundation | mango.blender.org**, and the film's
  volunteer translators. [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/),
  under the project's [sharing policy](https://mango.blender.org/sharing/).
  The original sharing/download pages are saved for provenance. The neighboring
  `copyright.txt` describes the soundtrack, not the subtitle license. One subtitle
  declares UTF-16LE by BOM; the other 23 decode as strict UTF-8.

These are 24 translations/variants of **one film**, not 24 independent production
pipelines. Representative production ASS/SSA/SAMI coverage remains open; the
0.1.5 expansion below adds three small licensed upstream samples. A candidate
upstream fixture with an identifiable commercial-anime title and unclear dialogue
rights was inspected but not vendored. Repository code licensing alone does not
establish the rights to every included film transcript.

Research dependencies and corpus are excluded from the npm tarball. They are
included, with attribution, in the local source/evidence snapshot. Runtime parser
dependencies remain zero. `research/quality-013/acquire.mjs` reproduces acquisition
into an empty corpus directory; saved hashes pin non-versioned Blender files.

## Independent expectations and disagreements

- The WPT file runner extracts **literal cue count, ID, raw text and time
  assertions** from 37 test definitions, without executing downloaded scripts.
  Computed loops, CSS/layout/regions and the stylesheet-only assertion are not
  evaluated. This is a subset (102 literal assertions), not a complete WPT conformance run. Eleven invalid
  signature files are also tested separately.
- All 78 WPT cue-text cases are compared as flattened reading text. Sixty agree;
  eighteen preserve malformed/unterminated markup that browsers discard. Those
  cases retain the upstream expectations in reports, and tests instead verify
  source preservation and a warning. They are not counted as conformance passes.
- WPT accepts four zero/reversed intervals in `timings-negative.test`; the package
  excludes them with `INVALID_INTERVAL` under its documented safe-interval
  contract. This difference is explicit, not hidden by changing WPT expectations.
- Blender expectations use source clock arithmetic, exact payload lines and
  documented whitespace/empty-cue rules, independently of production helpers.
  Portuguese `->` and Indonesian terminal punctuation are explicitly adjudicated
  recovery extensions. Twenty-two files have complete raw-payload/time oracles.
  Two Chinese files remain unresolved: truncated end clocks, detached payload,
  and blank lines inside records make automatic repair ambiguous. They are run
  and reported, but are not claimed as successful full-file extraction.
- Thirty independently authored ASS/SSA/SAMI cases use the libass guide,
  Aegisub tags and Microsoft SAMI documentation cited in `SOURCES.md`. They cover
  drawing/text boundaries, wrapping, karaoke, commas, Unicode, raw preservation,
  per-language updates, unknown ends, clear events and inert scripts.

The expanded WPT assertions found an actual defect: a header line immediately
before a timing line was incorrectly made into a cue ID when the header separator
was missing. The header now keeps that line. Browser-native parsing corroborates
the upstream expected ID. Incomplete WebVTT markup also now produces a warning.

## Pinned comparison targets

| Project | Version | Compared surface | Other useful capabilities / limits |
| --- | --- | --- | --- |
| subtitle | 4.2.2 | SRT/VTT cue times and payload | Streaming and serialization; not an all-format preservation API |
| @plussub/srt-vtt-parser | 2.0.5 | SRT/VTT cue times and payload | Small two-format parser; CRLF retention differences are shown explicitly |
| media-captions | 0.0.18 | Published npm SRT/VTT/ASS parsing | Richer rendering/streaming APIs; repository revisions are not substituted for this pinned npm version |
| webvtt-parser | 2.2.0 | VTT cue fields and tree text projection | Validator and semantic tree; stronger browser recovery alignment for discarded malformed markup |
| subsrt | 1.1.1 | ASS/SSA/SAMI reading text; plain synthetic performance | More formats and serializers; cannot preserve all SAMI languages/unknown ends in the compared API |
| ass-compiler | 0.1.16 | ASS/SSA time/raw text; plain synthetic performance | Richer tag/drawing compilation, outside this package's extraction scope |

No upstream runtime was adopted: the unified preservation/error/track contract
still requires independent code, while their renderers/serializers/ASTs solve
additional problems. No claim is made that our package is superior overall.
Cross-format aggregate scores would conceal incompatible contracts.

## Fuzzing, performance and memory

The reproducible fuzz runner alternates five format options, mutates acquired
SRT/WPT data and authored ASS/SSA/SAMI seeds, and exercises Unicode, delimiters,
tag fragments, invalid clocks, strict/replacement byte decoding and resource
limits. Each batch has a deterministic seed, 2,048 mutations and 256 independent
arithmetic/newline oracles. Each child has a 15-second watchdog and a 256 MiB V8
old-space ceiling. Failure inputs are saved; timed-out batches are seed-replayable.
The supervisor records elapsed wall time and hashes its runtime/corpus/harness.
This is mutation/property fuzzing, **not coverage-guided fuzzing**, and is not a
proof that no crashing or slow input exists.

Performance uses isolated child processes, two warmups, seven measured parses,
1k/10k/50k cues, and full verification of **every** cue before reporting throughput.
Plain workloads compare common APIs; rich markup workloads compare this version
to its unchanged 0.1.2 baseline. Any wrong output is disqualified from speed
ranking. Peak RSS is for the whole child, including runtime/imports/input and
validation. It is not parser-only allocation. Explicit-GC heap observations show
retained output and repeated-use drift; they are not a hard memory guarantee.
The 50k rich VTT input includes 250,001 lines, just above the default 250,000-line
budget, so both candidate and baseline correctly reject it; that cell has no
throughput score. A comparator timeout is a 60-second limit for the entire
nine-parse child, including checks/GC, not a measured single-parse duration.

Stress inputs cover newline/line/input limits, large metadata/track counts,
warning storms, unterminated tokens and repeated rich SAMI parsing. The parser
is synchronous and whole-document. Input/cue/diagnostic limits bound work, but
do not impose a hard RSS cap or execution deadline; use a disposable Worker or
process for host-enforced cancellation on untrusted bulk inputs.

Reproduce (from the source snapshot, Node 20+):

```sh
npm ci --ignore-scripts
npm test
npm --prefix research/reference-parsers ci --ignore-scripts
npm --prefix research/quality-013 ci --ignore-scripts
node research/quality-013/compare.mjs evidence/new-comparison.json
node research/quality-013/compare-formats.mjs evidence/new-formats.json
node research/quality-013/fuzz.mjs 900 evidence/new-fuzz-directory
node research/quality-013/performance.mjs evidence/new-performance.json
node --expose-gc --max-old-space-size=768 research/quality-013/performance.mjs stress
```

Output files/directories must be new. Run performance after fuzzing completes.
The 0.1.5 Windows Node 20/24, Chromium and Firefox observations do not establish
Safari, Linux, macOS, every ICU build or every legacy encoding's conformance. Windows-1252 has
an explicit WHATWG correction and exhaustive byte/alias tests; other legacy
decoders remain host-dependent.

## 0.1.5 expansion

`corpus/release-015/manifest.json` pins three additional original subtitle files:
two tiny ASS renderer samples from libass (ISC), and Microsoft's WMP SAMI sample
(MIT). Original license files, revisions, URLs and SHA-256 hashes accompany them.
`research/release-015/oracles.mjs` records literal expected clocks, text and raw
ASS overrides independently of the candidate. `test/release-corpus.test.mjs`
verifies source hashes and those semantics. These are upstream samples, not
film-scale production ASS/SSA coverage.

`research/release-015/exports.mjs` feeds independent SRT expectations from four
Blender translations (English, Hebrew, Japanese, Russian) to subsrt 1.1.1's
ASS/SSA/SMI writers. All twelve derived files are compared to those expectations.
ASS/SSA writer centisecond flooring and SAMI ASCII-whitespace projection are
explicit. This exercises one independent writer pipeline, not twelve new
original productions or independent correctness votes.

The expanded fuzz runner is `research/release-015/fuzz.mjs`; it additionally
seeds the three originals and thirty authored ASS/SSA/SAMI cases. Durations and
counts belong to each saved result, never to the requested duration alone.
The two damaged Chinese SRT inputs retain their existing ambiguity/partial
recovery limitations. No expected values were changed to bless recovered output.

Potential extra corpora with unclear licensing, embedded font redistribution
requirements or commercial song lyrics were not vendored. More licensed,
representative original ASS/SSA/SAMI files remain a release-quality improvement.
