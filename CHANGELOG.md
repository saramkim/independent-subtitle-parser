# Changelog

## 0.1.5 — publication preparation, unpublished

- Confirm the package name and apply the owner-selected MIT license to original
  code. Keep `private: true` until a separately authorized publication.
- Check actual archive bytes against source and installed files, verify npm
  integrity, enforce the package allowlist and require repeatable tarball bytes.
- Bound browser track options to 100 per page and shorten displayed labels;
  all tracks remain selectable and complete results remain in JSON.
- Add pinned, licensed libass and Microsoft WMP samples with independent
  expectations, plus a reproducible external-writer integration comparison.
- Expand fuzz seeds and clarify the remaining corpus and platform gaps.
- Parser runtime and public API remain unchanged from 0.1.4. No adapters,
  product changes or npm publication.

## 0.1.4 — consumer usability iteration, unpublished

- Reorganize README around installed-package use; move detailed contract to API
  reference and add diagnostic, usage and development guides.
- Include runnable Node and browser file examples in the tarball. Browser parsing
  runs in a disposable Worker with cancel/deadline/stale-result handling, explicit
  encoding/format choices, track selection, labeled previews and complete JSON.
- Keep decode and parse diagnostics distinct, unknown cue ends unchanged, and
  text output inert. No file upload, storage, charset guessing or rendering.
- Retain the existing public API and TypeScript interfaces; workflow helpers are
  consumer recipes, not package exports. Parser source is unchanged from 0.1.3.
- Correct stale documentation about the already completed product comparison.
- Preserve historical quality evidence; no product adapters or npm publication.

## 0.1.3 — corpus and robustness iteration, unpublished

- Fix WebVTT missing-separator recovery assigning header metadata as a cue ID.
- Recover SRT single-dash arrows and one terminal period after a complete comma
  end timestamp, with dedicated warnings and exact source retention. These occur
  in Blender's published Portuguese and Indonesian subtitles.
- Diagnose preserved unterminated WebVTT markup instead of returning clean status.
- Correct windows-1252 C1 characters on affected Node/ICU decoders using the
  WHATWG mapping; aliases resolve through TextDecoder. Other encodings remain
  runtime-dependent. No charset detection was introduced.
- Avoid the SAMI markup scanner for plain paragraphs and gaps while preserving
  HTML ASCII whitespace and non-ASCII spaces.
- Add pinned WPT and licensed Blender corpus, six OSS comparison targets,
  isolated performance/memory harnesses and reproducible sustained fuzzing.
- Test Node 20 and 24 plus Chromium. Evidence and remaining limits are recorded
  in the local `evidence/quality-013-final/REPORT.md` and `docs/CORPUS.md`.
- No adapters, product changes, runtime dependencies or publication.

## 0.1.2 — local quality iteration, unpublished

- Fix valid WebVTT class names containing Unicode spaces and voice annotations
  containing a literal `<`. Preserve the original tag in raw text and fields.
- Add 19 focused text regressions and generated arithmetic, newline, Unicode
  decode and malformed-content invariant checks.
- Define evidence-based public npm release gates and defer product adapters.
- No public API shape changes. Existing 0.1.0/0.1.1 and product-comparison evidence
  remains unchanged. Full WebVTT semantic trees and ASS rendering remain absent.

## 0.1.1 — unpublished

See `docs/IMPROVEMENTS.md` and the frozen `evidence/improvements-1/REPORT.md` in
the local source workspace for the original improvement record.
