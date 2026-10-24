# Reporting bugs

Report incorrect extraction, silent information loss, crashes, excessive resource
use or misleading documentation. A minimal text/byte reproduction is more useful
than a screenshot of a player, because rendering may be outside this parser.

## Where to report

This candidate has no announced canonical public repository or reporting inbox.
Prepare the report below and use only an existing verified maintainer contact;
do not send files to a guessed address. Once a public repository is announced,
use its Issues tab and the prepared Bug report form. A release must link that
repository from its package metadata and README before directing users there.

For a suspected security vulnerability, do not post secrets or an exploit against
a live service in a public issue. Use the repository's private vulnerability
reporting feature **if it is enabled**, or a verified private maintainer contact.
No private disclosure channel is advertised for this candidate yet; record the
details locally until a verified channel exists. No response SLA is promised.

## What to include

1. Package version and installation source (registry, tarball or Git commit).
2. Node/browser version, OS and bundler if relevant.
3. Exact `parse`, `decode` or `detectFormat` call and options, including limits.
4. A small shareable input. Preserve meaningful spaces, line endings and BOM.
   For decoding failures, provide a tiny byte/hex example and the chosen encoding;
   pasted text alone cannot reproduce an encoding defect.
5. Actual result: status, relevant cue/track/field values, diagnostic codes and
   `diagnosticsTruncated`. Include decode diagnostics as well as parse diagnostics.
6. Expected result and its basis: a specification section, source timing/structure
   or explicit consumer requirement. Another parser's output is useful comparison
   evidence, not automatically the correct answer.

For performance reports, include input size, cue count, process/Worker limits,
warmup/repetition method, elapsed time and memory measurement method. Distinguish
heap from RSS and report whether output was verified. A slow renderer or JSON
export is not necessarily slow parsing.

Copy this outline into a local report or the appropriate issue form:

```text
Package version / artifact or commit:
Runtime / OS / bundler:
API call and options:
Minimal input or byte sequence:
Input encoding / BOM / newline spelling:
Actual result and diagnostic codes:
Expected result and independent basis:
Reproduction steps:
Optional performance measurements:
Fixture source and redistribution permission (if not self-authored):
```

Do not upload full movie subtitles, personal captions, access tokens or full
logs containing private paths merely to demonstrate a bug. Reduce the input,
replace dialogue with your own text while preserving the failing structure,
and rerun the reproduction. If that removes the failure, describe what changed
without publishing the restricted content. Do not claim rights you have not
verified. The [contribution guide](../CONTRIBUTING.md) explains fixture policy.

## Before interpreting the result

- `partial` can mean styling was not applied; it does not by itself prove lost cues.
- `end: null` can be valid incomplete timing information in SAMI.
- The library does not perform full ASS rendering, apply HLS timestamp mapping,
  infer encodings or guarantee recovery from every damaged file.
- A budget failure is explicit. State the limit rather than silently removing it.

Consult the [API profile](API.md) and [diagnostic guide](DIAGNOSTICS.md). If the
documented behavior itself is unsuitable, explain the use case as a change
request rather than treating a different implementation as a mandatory oracle.
