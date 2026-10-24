# Quality criteria and evidence

This package aims to provide a dependable, information-preserving extraction API
across SRT, WebVTT, SAMI and ASS/SSA. It does not claim to be perfect or better
than every specialist library. Rendering, streaming and serialization are
separate capabilities. A faster result that loses cues is not a performance win.

## Current evidence

These observations describe the 0.1.7 runtime; documentation/package revisions
receive fresh artifact checks. Historical results are labeled separately.

| Area | Evidence and limits |
| --- | --- |
| Semantics | Independent format-derived tests for time, text, raw/source, tracks, fields, diagnostics and recovery; no complete rendering conformance claim |
| Corpus | Pinned WPT and licensed SRT/format fixtures; 0.1.6 added 37 ASS/SSA/SAMI originals; 0.1.7 added seven real ASS/SSA files and scored the three legacy SAMI cases under a narrow profile |
| Large real inputs | 23,889 events checked for timing/raw/fields; reading text scored only on 5,107 eligible events; 7.6 MB and 5.9 MB dense ASS excerpts plus three long-form SSA originals |
| Comparison | Pinned comparator outputs are adjudicated against independent expectations; raw whitespace/API differences are not automatically rendering defects |
| Robustness | Current ten-minute seeded campaign: 3,655,680 mutations and 456,960 arithmetic cases; 896 full-size original-file mutations; no observed failures. Historical one-hour 0.1.5 run is not a fresh 0.1.7 run |
| Performance/memory | Isolated real-file and synthetic command-stream observations, correct cue counts, GC and RSS reporting; additional metadata costs memory and RSS is not bounded by V8 old-space alone |
| Consumers | Hosted Node 20/22/24 on Windows/Ubuntu/macOS: 412 tests in each of nine jobs; local Windows Chromium 156: 16 scenarios; actual tarball imports/declarations/examples/links/byte identity checked |
| Unexecuted targets | Native Firefox/Safari and browser execution on Linux/macOS have not been revalidated for 0.1.7. Older Firefox evidence is specifically 0.1.5; Node CI does not validate browsers |
| Publication | MIT and provenance documented; public GitHub repository/reporting metadata connected; first hosted matrix passed; private:true retained and npm publication still requires explicit approval |

See [latest corpus details](CORPUS-017.md) and [earlier corpus methodology](CORPUS.md)
plus the [hosted CI record](CI.md)
for sources, dimensions, exclusions and reproduction. Local frozen reports are
not public download links or files included in a clone; the tracked harnesses
allow new evidence to be produced. Original files with unclear redistribution
rights stay outside Git/npm.

## Requirements for a behavior change

- Establish expected behavior from a specification, original source structure or
  an explicit documented recovery policy, before treating an output as correct.
- Preserve source/raw information and disclose omissions or unsupported effects.
  Check affected timing, text, breaks, tracks, fields and diagnostics.
- Exercise relevant malformed/large inputs and resource limits; preserve a failing
  regression case. Never manufacture expectations from the implementation.
- Verify package consumers and affected browser/runtime paths. Label unexecuted
  checks and known limits. Use isolated, comparable performance measurements.
- Record the exact source/artifact identity and distinguish new checks from reused
  evidence. Follow [CONTRIBUTING.md](../CONTRIBUTING.md) and [release gates](RELEASE.md).

## Known boundaries

The API is synchronous and whole-document. Complex layout, complete ASS override
execution, SAMI Source panel/legacy command effects, HLS timestamp-map application,
automatic encoding inference and round-trip serialization are not implemented.
Raw data retention does not make the reading projection a full semantic model.
Some damaged inputs remain ambiguous, including the two Chinese SRT cases in the
older corpus. No CI badge, throughput number or fuzz count establishes universal
correctness, and no overall score ranks incompatible parser/renderer APIs.
