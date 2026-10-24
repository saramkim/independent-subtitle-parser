# Consumer recipes

Import runtime functions and types from `independent-subtitle-parser` only.
`examples/` files are copyable host recipes, not supported package subpath exports.
They use relative `../dist/index.js` so they run both in a checkout and an installed
tarball. In your application replace that import with the package name.

## Choose a language track

```ts
import { parse } from 'independent-subtitle-parser';

function inspect(source: string) {
  const result = parse(source, { format: 'sami' });
  if (result.status === 'fatal') return { result, choices: [] };
  const choices = result.tracks.map(track => ({
    id: track.id,
    label: track.label ?? track.language ?? track.sourceClass ?? track.id,
  }));
  return { result, choices };
}
// After the user selects a choices[].id:
// const cues = result.cues.filter(cue => cue.trackId === selectedId);
```

Use exact track IDs. Language metadata can be missing or shared by multiple
tracks. Do not merge tracks, infer language from the text, or silently select
the first as a playback preference. The interactive example initially previews
the first track and exposes the selector; it is not a player. Empty tracks and
empty cues can be meaningful. `end: null` remains unknown, including in JSON.
The browser example displays 100 track choices per page and truncates labels
for display only. Previous/next controls expose every track; IDs and exported
metadata retain their complete values. Cue previews are separately capped at 100.

## Browser Worker and cancellation

`examples/parse-worker.mjs` handles file reading, decoding and parsing.
`examples/worker-client.mjs` starts a fresh module Worker for each job:

```js
// In a copy of the examples directory:
import { startParse } from './worker-client.mjs';

async function inspectFile(file) {
  const job = startParse(file, { encoding: 'euc-kr', format: 'sami' });
  // Connect a cancel button to job.cancel(). Rejection must be caught.
  try { return await job.promise; }
  catch (error) { console.error('Host failure:', error.message); return null; }
}
```

The helper terminates the worker after success, failure, cancellation or its
10-second deadline. The UI additionally invalidates prior requests when the file
or options change. It clears stale results immediately. Termination is host
cancellation, not a parser diagnostic. A deadline covers file reading, parsing
and result transfer and is not a parser performance guarantee. Timer scheduling
may be delayed in background tabs. There is no main-thread fallback if Worker
startup fails; show the host error and check HTTP/module/CSP support.

Bundlers should resolve `new Worker(new URL('./parse-worker.mjs', import.meta.url),
{ type: 'module' })` in their own asset pipeline. This example is served without
a bundler; no particular Worker asset pipeline is certified. The installed core
package is separately checked with esbuild 0.28.2's browser target and executed
without DOM/Node globals in a Node vm; this is not browser execution. CSP must allow your
own module and worker URLs. Do not loosen production policy just to run a demo.
The worker returns a full structured result: copying it and exporting JSON still
cost memory; JSON export runs on the main thread. Host limits remain important.

## Node example

```sh
node examples/node.mjs [file] [encoding|auto] [format|auto] [track-id|auto]
node examples/node.mjs ./movie.srt auto srt
```

The CLI validates a regular file, checks its size before reading, and bounds the
read even if the file grows. All stages and the full parse go to stdout as JSON.
An optional track ID adds `selectedTrackId` and `selectedCues` without removing
other tracks or cues. Invalid track IDs produce a host error.

| Exit | Meaning |
| --- | --- |
| 0 | Parse completed (`ok` **or** `partial`); inspect diagnostics and cue count. |
| 1 | Decoding or parsing failed; stdout contains the structured result. |
| 2 | File I/O, argument/API misuse or unexpected host error; stderr contains `hostError`. |

There is no CLI encoding fallback or replacement option. The browser checkbox
demonstrates deliberate replacement; your Node host can pass `fatal: false` to
`decode` and retain the warning. Regular-file I/O is bounded by bytes, not time;
applications needing hard time limits should use a child process/worker.

## CommonJS

```js
async function main() {
  const { parse } = await import('independent-subtitle-parser');
  const result = parse('1\n00:00:00,000 --> 00:00:01,000\nHello');
  console.log(result.status, result.diagnostics);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
```

## TypeScript and result decisions

```ts
import { parse, type ParseResult, type Cue } from 'independent-subtitle-parser';
function usable(result: ParseResult): Cue[] {
  if (result.status === 'fatal') return [];
  // This application's decision, not an assurance that every source cue survived:
  return result.cues;
}
void usable(parse('WEBVTT\n\n'));
```

`ParseResult` remains the same interface as 0.1.3. Checking `status` does not
narrow `format` from `SubtitleFormat | null`; check nullable values explicitly.
No `parseBytes` function or new result union was added. The example workflow
preserves the decode/parse boundary without creating a second public contract.
