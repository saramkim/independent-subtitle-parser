# Legacy SAMI commands and real ASS/SSA evaluation in 0.1.7

This follow-up validates extraction and information preservation. It does not
claim full rendering conformance or universal superiority over other parsers.

## Original inputs and rights

Seven original files were acquired without editing their bytes. Exact URLs,
Git revisions where available, encoding, byte length and SHA-256 are in
`research/corpus-017/local-manifest.json` in the source checkout.

| Input | Bytes | Dialogue events | Reading text scored |
| --- | ---: | ---: | ---: |
| jassub Kusuriya opening | 7,634,439 | 9,009 | 1,858 |
| jassub Beastars clip | 5,863,883 | 11,622 | 3 |
| FFmpeg Arabic SSA, .ass extension | 833 | 3 | 3 |
| FFmpeg Hebrew SSA, .ass extension | 848 | 3 | 3 |
| SSA source-1, Tekkon Kinkreet | 142,809 | 1,365 | 1,353 |
| SSA source-2, Ginga Tetsudou 999 | 94,703 | 1,004 | 1,004 |
| SSA source-3, Battle Flag III | 86,954 | 883 | 883 |

All 23,889 events have independently transcribed start/end times, raw Text,
ordered fields and source lines. All match. 38 Comment records and the absence
of rejected events are also checked. Reading text matches for 5,107 events in a
restricted profile; the other 18,782 are **not reading-text conformance passes**.
Complex drawing, wrap/reset state, malformed braces and Banner effects are
excluded from that score. Whole source preservation and format detection are
checked separately. No ASS/SSA runtime fix was justified by this expansion.

The two biggest files are dense animated excerpts, not long feature films:
their maximum event ends are 89,940 and 254,850 ms. The latter starts at
246,350 ms. The three SSA files extend to 6,600,700, 7,492,560 and 2,486,540 ms.
Source order is retained even when events are not chronological. SSA detection
follows content rather than the misleading .ass suffix of the bidi samples.

All seven files stay in ignored `.reference-cache/corpus-017/`. Dialogue and
music redistribution rights have not been established; repository code licenses
are not grants for these transcripts. Neither raw files nor generated transcript
expectations enter Git or npm. Only provenance and research scripts are tracked.

## Legacy SAMI commands

Three original FFmpeg samples from the previous corpus contain `SpanID`,
`ShowImg` and embedded `DisplayImg` authoring controls. SAMI_Demo is decoded
explicitly as Shift_JIS; the routing files use their recorded encodings.

| File | 0.1.6 cues | Expected/current cues | Commands preserved | Reading text |
| --- | ---: | ---: | ---: | --- |
| Intro_to_Message_Routing.smi | 58 | 56 | 58 | All 56 cues scored |
| Intro_to_SMTP_messaging.smi | 28 | 26 | 28 | All 26 cues scored |
| SAMI_Demo.smi | 48 | 46 | 50 | Not scored: layout/Source display |

0.1.6 exposed some commands as caption text and could prevent a blank caption
from clearing the previous one. 0.1.7 removes complete recognized command tokens
only from the reading projection and retains their decoded text with normalized
LF line endings, source
range and available SYNC/class context in metadata. It warns once and never
executes slide, image, navigation or script effects. Source text and raw cue/clear
payloads remain available. Incomplete tokens remain literal; recovery at `<`
prevents a broken quote from consuming the next SYNC. Near-match names and
escaped text do not activate this profile.

The basis is the original sample structure, the nonspoken control values, and
Microsoft's treatment of captions separately from DHTML demo effects. The
[historical Microsoft SAMI preview hosted by W3C](https://www.w3.org/WAI/sami.html)
describes ignoring unknown commands; it is not a W3C Recommendation. Microsoft's
[Understanding SAMI 1.0](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/dnacc/understanding-sami-1.0)
documents SYNC milliseconds, NBSP clears, supported tags and separate demo
effects. No authoritative grammar for the private commands was found. Therefore
this is an explicit, narrow compatibility policy, not complete command support.
Standalone `DisplayImg` is a synthetic extension-family test, not a claim of an
additional production sample. Demo layout and interactive playback stay unscored.

## Independent expectations and comparator differences

`oracles.mjs` and `sami-oracles.mjs` do not import the candidate or a reference
parser. They transcribe the pinned source grammar before running comparisons;
ASS time arithmetic uses BigInt centiseconds. SAMI times/classes/clears come from
the original SYNC/P structure, with the explicit nonspoken-command policy above.
The restricted generators are not general-purpose parsers. Tests also use
authored minimal cases, including malformed commands and 10,000-command streams.

Pinned `ass-compiler@0.1.16` and `subsrt@1.1.1` are observations, not answer keys:

- Both preserve event times in the two large ASS files. Each trims raw Text on
  617 Kusuriya events. Our raw-preservation API retains that whitespace; this
  difference alone is not a rendering defect in either comparator.
- ass-compiler trims one Hebrew event's leading whitespace. subsrt retains it.
- subsrt returns zero captions for source-1 because blank lines split the
  `[Events]` section from its Dialogue rows. The source's event grammar and
  independent transcript establish 1,365 events; ass-compiler and this package
  retain them. The other two long SSA files match both comparators.

No untested library or rendering behavior is ranked by these results.

## Reproduction and resource observations

Run from a source checkout. Acquisition is explicit and not part of normal
tests. Local transcript expectations must remain outside Git/npm. Use new output
paths (scripts refuse to overwrite evidence):

```sh
npm ci --ignore-scripts
npm run build
npm --prefix research/quality-013 ci --ignore-scripts
node research/corpus-017/acquire.mjs
node research/corpus-016/acquire.mjs --local
node research/corpus-017/oracles.mjs evidence/new-ass-expected.json
node research/corpus-017/sami-oracles.mjs evidence/new-sami-expected.json
node research/corpus-017/compare.mjs evidence/new-ass-expected.json evidence/new-ass.json
node research/corpus-017/compare-sami.mjs evidence/new-sami-expected.json evidence/new-sami.json
node research/corpus-017/fuzz.mjs 600 evidence/new-fuzz-017
node research/corpus-017/real-fuzz.mjs evidence/new-real-fuzz-017
# After fuzzing has ended, to avoid concurrent CPU load:
node research/corpus-017/performance.mjs evidence/new-real-performance.json
npm run validate
```

`compare-sami.mjs` accepts an optional frozen 0.1.6 index.js path after its input
and output arguments; `performance.mjs` accepts one after its output argument.
This optional local baseline is not required to verify expectations.
The ASS comparison always runs the two pinned open-source comparators.

The full-size original-file mutation runner covers 128 mutations per file, 896
in total, with deterministic insertion, deletion, truncation and token repetition.
It checks safety/preservation invariants, not semantic correctness of damaged
subtitles. Its worker deadline is 120 seconds and V8 old-space setting is 256 MiB.
The separate duration-based campaign includes recognized and damaged legacy-command tokens, independently
calculated valid timelines, all five format identifiers, decoding failures and
resource-limit invariants. It is seeded mutation/property testing, not coverage
guided fuzzing. Each batch has a 256 MiB V8 old-space setting and a deadline;
neither is a hard RSS bound. Real-file performance uses fresh sequential workers,
three warmups, 15 timed parses and GC between iterations. Timing excludes I/O and
decoding. Memory includes source and parsed result. Released-heap observations
can reveal retention but do not prove that no leak exists. Exact run results,
source fingerprint and package hashes are kept in the local frozen report.

One Windows/Node 24.18.0 run observed medians of 52.93 ms and 39.94 ms for the
two large ASS files, with sampled peak RSS about 135 and 137 MiB. These are not
cross-machine guarantees. The ASS runtime did not change from 0.1.6; small timing
differences between those versions are not evidence of an ASS optimization.
The same harness also checks the three legacy SAMI files, the 1,847-cue PBS
sample, and synthetic 10k/20k/40k command streams. The latter medians were
41.36/68.54/125.62 ms, with the 40k stream reaching about 221 MiB sampled RSS.
Preserving additional command records has a real memory cost. Released heap
after warmup showed no sustained growth in this bounded run; that is not a leak
proof. An initial single-line 40k probe correctly hit the default 1 MiB line
budget; the scaling run uses newline-separated records without raising limits.
