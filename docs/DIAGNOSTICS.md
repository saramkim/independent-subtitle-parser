# Diagnostics: what to do next

Always retain both decoding and parsing diagnostics. The example adds a `stage`
field for display; that field is host data, not part of the library's Diagnostic
type. Match stable `code` values instead of English message text. Unknown future
codes should still be shown with their severity and line, not treated as success.

## Make the decision at the right stage

1. If `decode().text === null`, do not call `parse`. Show the decoding reason.
2. If parsing is `fatal`, show diagnostics; cues/tracks/metadata are empty.
3. If parsing is `partial`, inspect codes. Some report recoverable spelling,
   some reject data, others describe unapplied styling. Severity does not quantify
   lost cues. Never claim “all cues recovered” from status or diagnostic count.
4. Even `ok` can contain `info` and zero cues. Check whether that is useful for
   your application. `ok` is not a full-format conformance certificate.
5. If `diagnosticsTruncated`, more diagnostics occurred than the configured cap.
   Do not infer absence of problems from the retained list. The UI also limits
   its preview separately; full JSON includes the returned list and cap flag.

## Common codes and actions

This is a task-oriented guide to common codes, not an exhaustive enum. The
[API reference](API.md) describes the complete support profile and budgets.

| Codes | Meaning and recommended host response |
| --- | --- |
| `ASS_TIME_WIDTH_RECOVERED` | A one-digit minute/second field was recovered without changing centisecond precision. Original fields retain its spelling. |
| `SAMI_SOURCE_ID_UNAPPLIED` | Source paragraph text/attributes are retained, but persistent speaker state and separate Source panel display are not modeled. Do not present the reading projection as a complete transcript of that display. |
| `INVALID_ENCODING` | Bytes are invalid in the chosen encoding. Ask for the known encoding or check the original file. Do not silently try alternatives. |
| `UNSUPPORTED_ENCODING`, `UNSUPPORTED_BOM` | Runtime lacks the encoding or UTF-32 is unsupported. Convert externally with an explicit encoding and retain the original. |
| `ENCODING_BOM_CONFLICT` | Explicit encoding conflicts with BOM. Correct the choice or investigate the source; do not ignore the BOM silently. |
| `DECODE_REPLACEMENT` | Caller opted into U+FFFD replacement. Some characters are lost even if the subsequent parse is `ok`. Display this warning. |
| `UNKNOWN_FORMAT`, `AMBIGUOUS_FORMAT`, `LOW_CONFIDENCE_FORMAT` | Content detection failed or was weak. Use an explicit known format; file extension alone is not proof. `.smi` uses `sami`. |
| `BYTE_LIMIT`, `INPUT_LIMIT`, `LINE_LIMIT`, `LINE_LENGTH_LIMIT`, `CUE_LIMIT` | Resource budget exceeded. Fatal parsing discards partial output. Check input and host capacity before increasing limits; do not silently truncate the source. |
| `INVALID_TIMING`, `INVALID_INTERVAL`, `ASS_INVALID_TIME`, `SAMI_INVALID_START` | Timing data was rejected. Inspect the indicated source line and neighboring cues. Do not invent corrected times. |
| `SRT_ARROW_RECOVERED`, `SRT_END_PUNCTUATION`, `SRT_TIME_EXTENSION`, `VTT_TIMING_RECOVERED`, `SRT_INDEX` | Nonstandard timing/index syntax was recovered. Review the source; the warning alone does not imply cue loss. |
| `MISSING_SEPARATOR` | A cue boundary was inferred. Timing-shaped dialogue can be ambiguous; inspect that boundary. |
| `EMPTY_CUE`, `CUE_ORDER`, `VTT_DUPLICATE_ID` | Check intentional empty text, source ordering or duplicate IDs. The library does not sort/deduplicate for you. |
| `UNKNOWN_MARKUP`, `UNTERMINATED_MARKUP`, `MARKUP_PRESERVED` | Markup was preserved or interpreted conservatively. Display as text and inspect raw/source data; never inject it as HTML. |
| `VTT_LAYOUT_UNAPPLIED`, `VTT_SETTING_UNSUPPORTED`, `SRT_SETTINGS_UNAPPLIED`, `ASS_RENDERING_UNSUPPORTED` | Text extraction does not reproduce layout or ASS rendering. Use a renderer if that is a product requirement. |
| `VTT_TIMESTAMP_MAP_UNAPPLIED`, `ASS_TIMER_UNAPPLIED` | Timeline mapping/scaling was not applied. Literal cue times may not align with external media clocks. |
| `SAMI_OPEN_ENDED_CUE`, `SAMI_AMBIGUOUS_END` | End may be null. Keep it unknown and let playback policy be an explicit application decision. |
| `SAMI_NON_TEXT_CONTENT`, `SAMI_IMAGE_NOT_RENDERED` | Non-text presentation was not executed. Source is retained; do not assume a faithful rendering. |

Source line numbers are one-based; cue source ranges are inclusive. Decoding
errors usually have no line because text was not successfully produced. English
diagnostic messages are explanatory, not a localized end-user UI contract.

## Errors outside content parsing

Invalid input types, unknown parse formats and invalid numeric budgets throw
`TypeError` or `RangeError`. Unsupported encoding labels instead return
`UNSUPPORTED_ENCODING` with `text: null`. File access denial, Worker load
failure, timeout and user cancellation are host outcomes. The examples keep them
separate instead of manufacturing parser diagnostic codes.

Do not automatically suppress all warnings after showing a successful preview.
A useful host can show readable cues while keeping a visible “review diagnostics”
state. Keep the original file so the user can investigate or repair it.

Successful decoding and `parse().status === 'ok'` do not prove that the selected
encoding is correct. A wrong single-byte encoding can preserve timestamps while
garbling dialogue. Check the readable text and change encoding explicitly.
