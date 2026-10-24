# Public npm release quality criteria

The first objective is a dependable public parser package. WebSubtitle/Play Plus
compatibility adapters are deferred until after core/package quality work. No
product code belongs in this runtime. Rendering, storage, file acquisition and
extension APIs remain outside the package; full ASS rendering remains excluded.

“Perfect” is an aspiration, not a testable release claim. Nor must a package beat
every specialist library at its own task. The defensible target is measurable
strength in this package's declared multi-format, information-preserving profile,
without hidden weaknesses or unsupported superiority claims.

## Evidence required before public release

| Area | Required evidence | Current state / gap |
| --- | --- | --- |
| Semantics | Independent format-derived oracles; raw/source retention; time/text/line/track checks | Synthetic oracles and generated arithmetic cases exist; full-format conformance is not established |
| External corpus | Licensed upstream conformance inputs and representative real files with attribution, fixed revisions, expected outcomes | Pinned WPT, 24 Blender SRT files, two small libass ASS samples and one Microsoft SAMI sample; film-scale original ASS/SSA/SAMI coverage remains open |
| Differential comparison | Version-pinned comparable APIs, same input, manual adjudication of disagreements | Six OSS targets, WPT subset, Blender raw/time and authored ASS/SSA/SAMI probes; preserved policy differences, no overall ranking |
| Malformed input | Termination, no throw for content, safe finite timestamps, bounded diagnostics, child timeouts, fuzz invariants | Seeded sustained mutation/property runner, child watchdog and arithmetic oracles; frozen 0.1.5 evidence records a completed one-hour run; not coverage-guided or exhaustive |
| Performance | Correct output count/content first; throughput and memory on plain/rich/large/adversarial inputs; same-runtime baselines | Isolated 1k/10k/50k plain/rich measurements, all-cue checks, peak process RSS, retained-heap and stress observations; no universal speed or memory advantage |
| Package consumers | Actual tarball installation, exported declarations, browser ESM, NodeNext/Bundler, lowest supported Node and current LTS | Windows Node 20.20.2/24.18.0, Chromium 156 and Firefox 158 tested; esbuild browser-target bundle checked separately; Safari/other OS/ICU combinations remain open |
| API stability | Documented units, source order, errors, recovery policies, limits, unsupported features and semver changes | Public contract documented; complete semantic AST/roundtrip/layout intentionally absent |
| Legal/publishing | Owner-approved package name/license, third-party provenance, metadata, reproducible artifact and explicit publication authorization | Name independent-subtitle-parser and MIT approved; private:true remains. Publication is not authorized. See RELEASE.md |

No numeric “better than all libraries” score combines incompatible outputs.
WebVTT AST/layout, stream parsers, serializers and full ASS renderers solve
different problems. Missing supported semantics is a defect; an explicitly
excluded rendering capability is a scope boundary. A faster result that drops
cues is disqualified from throughput comparison.

## Current strengths and limitations

The useful proposition is one zero-runtime-dependency API across SRT, WebVTT,
SAMI and ASS/SSA, retaining exact source, raw payload, tracks and detailed
diagnostics. These properties are observable in tests. They do not establish
better overall conformance, performance, maintenance cost or ecosystem maturity.
Some existing projects provide richer semantic trees, rendering, streaming or
serialization. Current research does not measure every major project/version.

The product comparison found two valid WebVTT class/voice projection defects in
0.1.1. They are fixed in 0.1.2 with format-derived Unicode/annotation regression
cases. The new cases initially failed on 0.1.1; expected values were not changed
to match an implementation. Property tests also generate exact timestamps before
serializing inputs, vary newline encodings, and check seeded malformed-content
invariants under a process timeout. This improves evidence, not perfection.

## Work order

1. Correctness defects and declared-profile edge cases, with independent oracles.
2. Licensed conformance/real-file corpus and disagreement triage across pinned OSS.
3. Sustained fuzzing, allocation/CPU profiling, worst-case input and memory limits.
4. Multi-runtime package compatibility, API/documentation review and release gates.
5. Package name/license decisions and an approved immutable publish candidate.
6. Product compatibility adapters and integration, last.

Version 0.1.6 is local publication preparation. It is not a public-release sign-off.
The [current corpus expansion](CORPUS-016.md) adds 37 originals, including a long
SAMI broadcast sample. Historical browser/OS results in the table above refer to
0.1.5; they are not fresh validation of the changed 0.1.6 runtime.
See [corpus and robustness methodology](CORPUS.md), including the two unresolved
damaged Chinese files and intentional differences from browser error recovery.
