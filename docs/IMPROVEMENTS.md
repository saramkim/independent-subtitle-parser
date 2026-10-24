# Open-source-informed improvement pass (0.1.1)

Date: 2026-10-23. The user authorized improving the independent parser using major
open sources as references. Neither product's source, history, fixtures nor package
dependencies were accessed. Phase-one evidence remains byte-for-byte unchanged;
current sources are a new candidate. No upstream parser implementation or fixture
was copied into the runtime or tests. Runtime dependencies remain zero.

## References and decisions

| Reference | What informed this pass | Decision |
| --- | --- | --- |
| [w3c/webvtt.js](https://github.com/w3c/webvtt.js), npm `webvtt-parser@2.2.0` (CC0) | Validation versus recoverable parsing; focused timing behavior. | Implement the independently specified W3C recoveries and preserve diagnostics. No dependency adoption. |
| [vidstack/captions](https://github.com/vidstack/captions), npm `media-captions@0.0.18` (MIT) | Configurable diagnostics, streams, separate parser/renderer, browser/server exports. | Improve our small-budget diagnostics; retain a focused extraction API. Streaming is deferred because preserving the full source/result still dominates memory and genuine streaming requires a separate contract. |
| [subtitle.js](https://github.com/gsantiago/subtitle.js), npm `subtitle@4.2.2` (MIT) | Synchronous/stream APIs, transforms and serialization. | Exercise time/raw-payload probes; defer serializer/transforms rather than expand parser scope. |
| [plussub/srt-vtt-parser](https://github.com/plussub/srt-vtt-parser), npm `@plussub/srt-vtt-parser@2.0.5` (MIT) | Small dependency-free API and SRT/VTT processing. | Keep the small root API; compare focused timing cases without treating library agreement as correctness. |
| [Aegisub ASS tags](https://aegisub.org/docs/latest/ass_tags/#override-tags), [libass 0.17.5 parsing](https://github.com/libass/libass/blob/0.17.5/libass/ass_parse.c#L876-L884), [libass literal-brace extension](https://github.com/libass/libass/wiki/Libass%27-ASS-Extensions#literal-curly-brackets) | Omitted p/q parameters and literal braces affect extracted dialogue. | Independently implement narrow text fixes; identify libass-specific brace behavior and renderer differences. No renderer/code adoption. |

The registry's pinned media-captions version differs from the upstream repository's
package version (1.0.4 at review time). Results describe the installed **0.0.18**,
not the current repository head. Registry integrity hashes and all transitive
versions are fixed in `research/reference-parsers/package-lock.json`. Dependencies
are isolated there, excluded from the published package allowlist, installed with
scripts disabled, and not used by the normal build/test/validation commands.

## Changes and independent grounds

- **WebVTT timing recovery:** [W3C 2026 sections 4 and 6.3](https://www.w3.org/TR/2026/CRD-webvtt1-20260520/)
  distinguish authoring from parsing. Compact arrows, single-digit hours, FF ASCII
  whitespace, and adjacent end/settings are recoverable. They now produce cues
  and `VTT_TIMING_RECOVERED`, not silently missing captions. Clock ranges and exactly
  three fractional digits stay enforced. NBSP/VT are not ASCII whitespace.
- **WebVTT validation:** duplicate IDs and file syntax `line:auto` warn while raw
  data remains. `auto` is a cue API/default value, not a serialized line setting.
- **Unicode and bounded timing work:** only CR/LF split subtitle lines. U+2028 and
  U+2029 inside a setting are retained. Independent review exposed overlapping
  whitespace/remainder regex backtracking on 100k spaces plus U+2028 (over 5 seconds
  in the isolated pre-fix regression); full-character remainder consumption fixes
  both lost cues and that attack. Regression runs in a disposable process.
- **ASS text:** bare `\p` restores spoken text after drawing; bare `\q` restores
  script WrapStyle even after Banner initializes wrap mode 2. `\{` and `\}` use
  the libass extension and emit `ASS_LIBASS_ESCAPED_BRACES`. Raw tags/drawings stay
  unchanged. Similar tag prefixes and nested transform arguments are not resets.
- **ASS reset limit:** existing `\r` extraction resets wrap/drawing. The libass
  render-context reset does not follow that same approximation. Rather than claim
  renderer equivalence, changed text state now emits `ASS_RESET_APPROXIMATION`.
  Full override/style semantics remain outside this parser.
- **Diagnostic retention:** a budget of one previously could leave only a generic
  truncation marker instead of the actual error. Highest severity messages now win,
  ties retain earlier occurrences, returned order follows source encounters, and
  `diagnosticsTruncated` independently discloses omitted messages. Fixed buckets
  avoid rescanning the full diagnostic array per rejected message.
- **Cross-realm decode:** genuine Uint8Arrays from an iframe/VM now work, using
  [ECMAScript internal-slot branding](https://tc39.es/ecma262/#sec-get-%typedarray%.prototype-%symbol.tostringtag%).
  Buffer/subarray behavior remains; spoofed types or byteLength cannot bypass limits.
- **Ordinary ASS text:** a direct return when no override/escape exists removes an
  unnecessary character loop. This is a local optimization, not a comparative speed
  claim. Output equivalence is tested on Unicode and significant whitespace.
- **Evidence safety:** validation discovers new test files and exclusively creates
  its output directory. It no longer overwrites `evidence/phase-1` or omits newly
  named suites from its fixed list.

## Migration

Consumers should inspect `result.diagnosticsTruncated` instead of the old synthetic
`DIAGNOSTICS_TRUNCATED` code. It is always present, including preflight failures.
Repeated info-code coalescing does not set it. Truncation continues to make the
result partial. Additional VTT recoveries/diagnostics and ASS extraction changes
are intentional behavior changes; the original source remains available.

## Focused reference experiment

Reproduce separately after the normal build:

```sh
npm ci --prefix research/reference-parsers --ignore-scripts --no-audit --no-fund
node research/reference-parsers/probe.mjs
```

Thirteen newly authored cases have literal expected times and raw payload, derived
from the public formats or a labeled preservation policy. The probe normalizes
seconds to milliseconds for APIs that use seconds. Nonfinite numbers are explicitly
encoded in JSON rather than silently turned into null. Cases unsupported by a
library are omitted, not failures. Errors and differing output are observations,
not automatic proof of a competitor defect; recovery contracts vary. The frozen
report includes every input, expected value, version and observed output.

This set focuses on the changed paths. It is not a representative real-file corpus,
rendering comparison, complete conformance suite, security audit, or performance
ranking. No runtime dependency is justified merely by a library's richer feature
list, and zero dependencies is not a claim of greater correctness or safety.
