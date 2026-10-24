# Parser design

The boundary is a decoded subtitle document, not a video player. The main API is
`parse(string)`; byte decoding is a separate `decode(Uint8Array)` helper. This
keeps transport, storage, UI, extension permissions and encoding selection in the
host and makes the same parser callable from a browser worker or Node.js.

## Small architecture

`index.ts` validates options/budgets and dispatches. `detect.ts` supplies a bounded
heuristic. `context.ts` collects diagnostics, preserves fatal reasons and enforces
cue/time invariants. SRT and VTT share block/timing mechanics in `formats/timed.ts`
but retain separate grammars and signature rules. SAMI uses a forward markup
scanner and per-class active state. ASS uses line/section state and declared field
maps. `text.ts` produces reading text without DOM; `entities.ts` is generated
standard data. There is no plugin framework, generic AST visitor or rendering
layer. Internal modules are outside the public export map.

## Preservation before interpretation

The original string is always returned. Cues also retain raw payload and ordered
format fields, while non-cue records are metadata. Therefore an unsupported
rendering feature is inspectable without pretending it was applied. Plain text
is a convenience projection and can be insufficient for faithful rendering:
voice/language/ruby boundaries, ASS drawings and Source panels need raw records.
An exact-source string is not byte-perfect preservation: the caller owns bytes.

Times use safe integer milliseconds, with arithmetic rather than Date objects.
SAMI unknown ends are represented as `null`; metadata duration is not assumed to
be the final end. Per-class timing avoids erasing a language when another changes.
An empty SYNC is a whole-block clear following historical Microsoft guidance;
explicit NBSP paragraphs clear their class. Source order/duplicates/overlap stay
visible rather than being silently rewritten.

## Explicit recovery policy

No broad strict/lenient toggle is offered in phase one. The supported grammars and
documented recoveries form one predictable profile; callers can reject `partial`
or selected diagnostic codes. Invalid cue times are never filled from zero or
neighboring text. Resource failures discard the partial interpretation so a host
cannot mistake truncation for a complete document. File errors return results;
programming errors throw. Repeated informational codes coalesce. Since 0.1.1,
four fixed severity buckets retain the most actionable bounded diagnostics in
encounter order and a separate `diagnosticsTruncated` flag reports omissions.
Overflow retention work is constant per message; only retained messages are sorted.

ASS Format flexibility and overflow-component compatibility are explicitly
de facto extensions. WebVTT parsing is extraction-oriented and deliberately does
not claim exact browser error-recovery or rendering equivalence. SRT lacks a
universal normative grammar. These distinctions matter when a later comparison
finds differences: neither current products nor this package automatically wins.
Legacy ASS/SSA Timer scaling remains unapplied with a warning for non-100/invalid
values; cue times retain the literal event timestamps. A known ScriptType that
conflicts with selected format is also diagnosed rather than silently relabeled.

## Encoding and detection

Decode first, then parse. BOM selection and explicit decoder labels are accepted;
statistical charset inference is not. Strict decode defaults prevent accidental
replacement from disappearing into a normal parse result. A caller can keep a
failed byte buffer and retry a user-selected label without changing parser state.
TextDecoder label availability is a runtime property. UTF-32 is rejected before
its prefix can masquerade as UTF-16LE. Format detection never uses file extension
as authority and reports ambiguity for headerless dot timestamps.

## Testing and review

An independent role wrote source-grounded oracle fixtures before inspecting
implementation. Format authors added targeted tests; a non-author reviewed the
SAMI parser and the independent oracle author reviewed shared parsing, detection,
resource handling and package consumption. Expected-value corrections require a
source or explicit policy rationale (e.g. SAMI empty SYNC historical guidance),
not matching the current output. Test files distinguish normative facts from
synthetic recovery policies. No product code or fixtures were accessed during
phase one. The later, separately authorized product comparison is historical
evidence; it did not make either product an authoritative test oracle.

Security/performance review reproduced and fixed exponential comment-prefix
detection, newline rescanning, CSS selector/declaration multiplication, unsafe
time handling, quoted-tag corruption, unsupported time-unit interpretation and
metadata/cue ambiguity. Large-input count/endpoints have arithmetic oracles.
Benchmark timings are observations on one machine, not unit-test correctness
criteria. Package tests install the actual tarball offline and compile consumers
under both TypeScript resolution modes.

## Deferred deliberately

No serializer, transformation pipeline, CLI product, charset detector, renderer,
video demuxer, network fetcher, storage adapter, CommonJS build or integration into
the two products is included. Broader real-file corpus and platform testing,
full semantic AST needs and public release remain future work. The owner has
selected the independent-subtitle-parser name and MIT license; publication is
still separately gated by `private: true` and explicit authorization. The local
hash manifest pins each candidate for comparison.
