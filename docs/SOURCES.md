# Sources and independent test oracles

Research date: 2026-10-23 (Pacific/Auckland). This first implementation was designed from the public documents below and the requested use cases. Neither WebSubtitle nor Play Plus source, history, or fixtures were inspected or copied. Existing package documentation was reviewed; their implementations were not copied. Test inputs are newly authored, short synthetic examples, not subtitle content taken from films.

## Evidence hierarchy

1. WebVTT and character decoding have published standards.
2. SRT is a de facto format. Library of Congress and Matroska documentation establish its baseline; they do not provide a universal strict parser/recovery standard.
3. SAMI is described by its original vendor. ASS/SSA behavior is documented by the format ecosystem; renderer-specific extensions are identified as such.
4. Recovery, resource limits, error severity, final SAMI end times, and plain-text projection are explicit package policies. They must not be presented as normative requirements.

## Format references

| ID | Public source | Rules used by independently authored tests |
| --- | --- | --- |
| VTT | [W3C WebVTT, Candidate Recommendation Draft, 20 May 2026](https://www.w3.org/TR/2026/CRD-webvtt1-20260520/) ([living publication](https://www.w3.org/TR/webvtt1/)), especially sections 4.1, 4.2, 6.1–6.4 | UTF-8 signature; optional cue identifiers; timestamps have minute/second ranges 0–59 and three decimal digits; optional hours have at least two digits. Cues may overlap. Preserve cue payload, settings, voice/language/ruby/timestamp markup and NOTE/STYLE/REGION data. Authoring rules and browser recovery algorithms are distinct. |
| SRT | [Library of Congress: SubRip Subtitle format](https://www.loc.gov/preservation/digital/formats/fdd/fdd000569.shtml), updated 2025-05-27 | Number, comma-millisecond timing pair, multiline payload, blank separator; HTML-derived formatting varies by player. The mentioned 32-character line guideline is not used to truncate or reject text. |
| MKV | [Matroska: Subtitle Codecs](https://www.matroska.org/technical/subtitles.html), SRT and SSA/ASS sections | Independent corroboration of SRT structure; SSA/ASS timestamps use centiseconds (`h:mm:ss.cc`). Container framing/remuxing is outside this package. |
| SAMI | [Microsoft: Understanding SAMI 1.0](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/dnacc/understanding-sami-1.0), Class and Localization, Source ID, Synchronization | SYNC Start uses elapsed milliseconds; paragraph classes identify language selections; CSS class Name/Lang metadata; BR forces a break; non-breaking-space paragraphs clear captions. Multiple paragraph classes must not collapse into a single track. Source IDs have additional display behavior beyond basic paragraph extraction. |
| SAMI-MF | [Microsoft: SAMI Media Source](https://learn.microsoft.com/en-us/windows/win32/medfound/sami-media-source) | Corroborates a multilingual SAMI source as separate language streams; official example uses class definitions and SYNC/P markup. |
| ASS | [libass: ASS File Format Guide](https://github.com/libass/libass/wiki/ASS-File-Format-Guide), Script Info, Styles, Events | ScriptType identifies SSA v4 versus ASS v4+; dialogue fields have a defined order and Text is final so text may contain commas; Comment events are retained but not dialogue. Preserve raw headers/styles/fields rather than claiming full rendering. |
| ASS-TEXT | [Aegisub: ASS Override Tags](https://aegisub.org/docs/latest/ass_tags/), Special characters, Wrap style, Drawing tags | `\N` is always a forced break; `\n` is a space except wrapping mode 2; `\h` is a non-breaking space. Override and drawing commands are not spoken text. Formatting semantics remain available in raw payload. |
| ASS-EXT | [libass: ASS Extensions](https://github.com/libass/libass/wiki/Libass%27-ASS-Extensions), Custom format lines | Reordered/short Format declarations are a libass extension and not reliably portable to VSFilter. Tests for them validate a documented interoperability policy, not universal ASS conformance. |
| SSA-HISTORY | [libass: SSA Version History](https://github.com/libass/libass/wiki/SSA-Version-History) | Legacy files include non-default Timer headers. The package retains literal event timestamps and warns that non-default legacy Timer playback scaling is unapplied; this is an explicit support limitation. |
| ENC | [WHATWG Encoding Standard](https://encoding.spec.whatwg.org/), TextDecoder and decoder error modes | Decoding bytes and parsing Unicode text are separate operations. UTF BOM handling, explicit encoding labels, and fatal versus replacement errors are tested independently. No language-based encoding guess is assumed correct. |
| HTML | [WHATWG HTML character-reference parsing](https://html.spec.whatwg.org/multipage/parsing.html#character-reference-state) and [named references](https://html.spec.whatwg.org/multipage/named-characters.html#named-character-references) | WebVTT 2026 delegates character references to HTML. Numeric references and named references beyond the older six-name subset are legitimate cue text. The implementation uses the public entity data table; see THIRD_PARTY_NOTICES.md. |
| CSS | [W3C CSS 2.2 tokenization](https://www.w3.org/TR/CSS22/syndata.html#tokenization) | A comment-looking sequence inside a quoted string is string content; SAMI label extraction must not silently delete it. This package does not implement a CSS renderer. |

## Expected-value design

These expectations were chosen from the sources and requirements before inspecting parser implementation:

| Case | Independent expected fact |
| --- | --- |
| SRT `01:02:03,004` | 3,723,004 milliseconds by `1*3600000 + 2*60000 + 3*1000 + 4`. |
| VTT `01:02:03.004` | The same 3,723,004 milliseconds; `02:03.004` means 123,004 milliseconds. |
| ASS `1:02:03.04` | 3,723,040 milliseconds; `.04` is 40 milliseconds, not 4. |
| Multilingual text | Korean, Japanese, Arabic, combining marks, emoji, and authored line breaks survive unchanged; no normalization or trimming of meaningful payload spaces. |
| SAMI classes | Korean and English paragraphs remain separate tracks, including nonidentical update times. A later clear ends the earlier text for that class. An unbounded final caption is represented with an unknown end and a diagnostic, not an invented duration. |
| ASS text | Text-field commas remain literal; hard/soft breaks and hard spaces have distinct meaning; raw overrides and drawings remain inspectable. |
| Damage | Valid later cues survive a malformed cue in recovery mode. Reversed/nonfinite/unsafe times never become successful cues; rejected information remains in source/rejected records and diagnostics. |
| Large input | Generated records have arithmetically determined counts and endpoints; configured limits produce explicit failure or partial-result signals. Timing thresholds are not normative format tests. |

Changing an expected value requires a source correction or a documented policy decision. A current implementation's output alone is not a test oracle. Fixtures include a mix of normative syntax cases and deliberately malformed recovery cases; passing them is not a claim of exhaustive conformance or real-world corpus coverage.

SAMI's unknown final end is represented as `null` plus an informational diagnostic. It is valid incomplete timing information rather than malformed syntax, so it need not make the entire result partial. The initial test author's stronger warning assumption was corrected through this explicit API-policy decision before interpreting the test result; the source specifies no diagnostic severity.

The initial oracle suite was authored before implementation inspection. Further regression cases were added during independent review: literal SRT arrows, WebVTT 2026 entities and component classes, NOTE tab separators, quoted CSS label content, ambiguity, fatal resource limits, and a repeated-comment detection attack. These use source-derived values or explicit bounded-work/security policies. The attack test runs in a disposable child process with a timeout so a regression cannot indefinitely hang the test runner.

## Existing library assessment

The 0.1.3 expansion pins WPT and licensed real subtitles, adds subsrt 1.1.1 and
ass-compiler 0.1.16 comparisons, and records the complete methodology and
attribution in [CORPUS.md](CORPUS.md). Windows-1252 expected byte values come from
[WHATWG's index](https://encoding.spec.whatwg.org/index-windows-1252.txt).
The observed Node 20 mismatch is also documented in
[Node issue 56542](https://github.com/nodejs/node/issues/56542); the specification,
not that implementation's output, determines the correction.

For phase one, only public README/package documentation was consulted. That initial scope assessment was not a comparative code audit or benchmark. The subsequent 0.1.1 improvement pass additionally consulted public implementation behavior and ran pinned packages on a small independent fixture set; see [IMPROVEMENTS.md](IMPROVEMENTS.md).

| Candidate | Documented scope | Decision for phase 1 |
| --- | --- | --- |
| [subtitle](https://github.com/gsantiago/subtitle.js) | TypeScript, stream/synchronous APIs, SRT and partial WebVTT. | Not adopted: SAMI and ASS/SSA would still require independent work and a unified preservation/diagnostic contract. A useful future benchmark candidate. |
| [@plussub/srt-vtt-parser](https://github.com/plussub/srt-vtt-parser) | Dependency-free TypeScript SRT/WebVTT parser. | Not adopted: narrower advertised format scope than the required four families. No claim is made that its parsing is inferior. |
| [media-captions](https://github.com/vidstack/captions) | Parser/renderer APIs, VTT/SRT/SSA/ASS, streams, server-side use; parser and renderer are separable. | Not adopted for phase one: SAMI and a unified preservation contract still need work. An optional renderer is not itself a reason to reject its parser. The initial lookup used a fork; the improvement review uses upstream. |
| [w3c/webvtt.js](https://github.com/w3c/webvtt.js) | WebVTT parser and validator. | Not adopted: single-format scope. A possible independent differential oracle later; not used to manufacture this phase's expected outputs. |
| [libass](https://github.com/libass/libass) | Native ASS/SSA renderer. | Not adopted: full rendering and native/WASM packaging are outside this TypeScript parsing task. Its public format guide was used as documentation. |

The initial runtime therefore has no third-party parser dependency. This decision reduces the surface area that must be reconciled for phase 1; it is not a permanent ban on dependencies or evidence that independent code is automatically more correct.
