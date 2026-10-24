# ASS/SSA/SAMI validation in 0.1.6

This is a bounded extraction-profile evaluation, not full rendering conformance
or a claim to be better than every subtitle library.

## Inputs and redistribution

The expansion contains 37 original upstream files, without rewriting their bytes:

| Group | Files | Coverage and rights |
| --- | ---: | --- |
| libjass | 15 ASS | Authored unit/renderer samples; Apache-2.0; no embedded fonts/images |
| Subtitle Edit | 1 ASS + 1 SSA | Converter samples; MIT |
| subtitle-rs/subtitler | 1 SAMI | English/Korean example; Apache-2.0 |
| go-astisub | 4 SSA/ASS | Related fixtures, CR-only and three fractional digits; local only |
| Gaupol | 2 SSA/ASS | Related dialogue excerpts with negative times; local only |
| FFmpeg sample archive | 12 SAMI | Authoring tools, classes, Source IDs, layout, Shift_JIS, EUC-KR and windows-1252; local only |
| PBS pycaption | 1 SAMI | 204,256 bytes, 2,186 SYNC blocks, 1,847 nonblank cues, last clear at 6,534,661 ms; local only |

The 18 redistributable samples and three licenses are in `corpus/corpus-016/`.
The other 19 files remain in `.reference-cache/corpus-016/`, excluded from Git
and npm. Repository code licenses do not automatically grant permission to
redistribute dialogue, music, fonts or images. Local metadata records retrieval
URLs, sizes and SHA-256 hashes, not license grants. Git revisions are pinned;
FFmpeg's mutable archive URLs are hash checked and changed downloads rejected.
Related exports are not independent productions. Large production ASS/SSA
coverage remains limited.

## Independent expectations and adjudication

`derive-oracles.mjs` transcribes the restricted public ASS grammar and literal
SAMI expectations without importing any parser under test. Checked-in
`expected.json` predates the fixes. Tests check source hashes, times, reading/raw
text, event fields, lines, rejected events and comments in that profile.
`local-oracles.mjs` independently generates local transcript expectations, kept
out of Git/npm. Both generators refuse unfamiliar grammar instead of using
candidate output as the answer.

34 files have scored expectations: 32 include reading text and two layout-heavy
SAMI files score timing/classes only. All 34 match the candidate's declared
profile. Seven rejected local ASS/SSA events are checked verbatim: four negative
time events in two related files and three ambiguous fractional timestamps.
The PBS sample is checked across all 1,847 cues, including time, text, clears
and tracks. Explicit encoding is checked against `TextDecoder`; no charset
guessing was introduced.

Three FFmpeg files (`Intro_to_Message_Routing.smi`,
`Intro_to_SMTP_messaging.smi`, `SAMI_Demo.smi`) contain nonstandard `SpanID` and
`ShowImg` commands. Exact source retention and malformed-tag diagnostics are
checked, but cue/layout conformance is **unscored** without a tool-specific
playback oracle. Malformed command spelling can appear literally in reading text.
The initial generic tag-stripping oracle incorrectly hid these commands. That
failed result is preserved in evidence and is not counted as a pass.

Two other local oracle assumptions were corrected from independent rules:
an empty paragraph-less SYNC closes all active classes (`sami-div.smi`), and
legacy HTML `&nbsp` without a semicolon clears the initial `bora_1.smi` caption.
These corrections changed no runtime code. Both initial and corrected results
are retained. Physical block layout and persistent Source panels remain outside
the reading-text contract.

## Evidence-backed changes

1. `libjass/tests/functional/t/alpha.ass` contains `0:00:7.00`. Its first event
   was previously dropped. Unpadded minute/second recovery is unambiguous and
   consistent with libass's integer-component reader. It now emits
   `ASS_TIME_WIDTH_RECOVERED`. Fractional precision remains exactly two digits;
   `.766` is not silently interpreted as milliseconds.
2. Real SAMI `SAMI_Type: CC` now populates track kind alongside `SAMIType`.
   Original style metadata remains retained.
3. `SAMI_SOURCE_ID_UNAPPLIED` warns once per document about unsupported persistent
   speaker semantics. Text and attributes remain retained. This discloses a
   limitation; it does not implement the Source panel.

Primary references: [Microsoft SAMI](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/dnacc/understanding-sami-1.0),
[historical SAMI guidance](https://www.w3.org/WAI/sami.html), and
[pinned libass time reader](https://github.com/libass/libass/blob/f61db567e6593df3470e91594bcd4ad2d0473aff/libass/ass.c#L231).

## Comparison boundaries

Pinned `subsrt@1.1.1` matches 11 of 34 scored files on the selected time/text
dimension. `ass-compiler@0.1.16` matches 18 of 23 ASS/SSA inputs on time/raw text.
The candidate matches all 34 on its declared dimensions, including SAMI classes.
These are profile matches, **not defect counts or an overall ranking**.
Zero/negative durations, strict centiseconds, soft breaks, unknown SAMI final ends,
clear paragraphs and multiple classes differ between APIs. Retaining negative
events in a structural parser is not inherently wrong. Rendering, animation,
fonts and style fidelity are not scored. No comparator implementation or runtime
dependency was adopted.

## Reproduction

From the source checkout, with new report paths:

```sh
npm ci --ignore-scripts
npm test
node research/corpus-016/acquire.mjs
node research/corpus-016/acquire.mjs --local
node research/corpus-016/local-oracles.mjs evidence/new-local-expected.json
npm --prefix research/quality-013 ci --ignore-scripts
node research/corpus-016/compare.mjs evidence/new-local-expected.json evidence/new-comparison.json
node research/corpus-016/fuzz.mjs 600 evidence/new-expanded-fuzz
```

Optional local acquisition does not authorize redistribution. The public suite
uses only vendored samples. Run performance after fuzzing to avoid CPU contention.
Platform and duration claims belong to the exact saved run, not earlier versions.
