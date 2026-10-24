// Source checkout: node examples/node.mjs [file] [encoding] [format] [track-id]
// Use "auto" to omit an encoding/format/track argument. No file runs a sample.
import { open } from 'node:fs/promises';
import { MAX_FILE_BYTES, readSubtitle, selectTrack } from './workflow.mjs';

try {
  const [path, encoding, format, trackId, ...extra] = process.argv.slice(2);
  if (extra.length) throw new Error('Usage: node node.mjs [file] [encoding|auto] [format|auto] [track-id|auto]');
  let bytes;
  if (path) {
    const file = await open(path, 'r');
    try {
      const stat = await file.stat();
      if (!stat.isFile()) throw new Error('Input must be a regular file.');
      if (stat.size > MAX_FILE_BYTES) throw new Error('File exceeds the example limit of 16 MiB.');
      // Bounded read also protects against a file that grows after stat().
      const buffer = new Uint8Array(MAX_FILE_BYTES + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await file.read(buffer, length, buffer.length - length, null);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > MAX_FILE_BYTES) throw new Error('File exceeds the example limit of 16 MiB.');
      bytes = buffer.subarray(0, length);
    } finally { await file.close(); }
  } else bytes = new TextEncoder().encode('1\n00:00:01,250 --> 00:00:03,000\n안녕하세요\nHello');
  const explicit = value => !value || value === 'auto' ? undefined : value;
  const result = readSubtitle(bytes, { encoding: explicit(encoding), format: explicit(format) });
  if (explicit(trackId) && result.parsed && result.parsed.status !== 'fatal') {
    result.selectedTrackId = trackId;
    result.selectedCues = selectTrack(result.parsed, trackId);
  }
  // stdout is machine-readable and retains all stages and the complete parse.
  console.log(JSON.stringify(result, null, 2));
  if (!result.parsed || result.parsed.status === 'fatal') process.exitCode = 1;
  // Partial results exit 0; consumers must inspect diagnostics and decide policy.
} catch (error) {
  console.error(JSON.stringify({ hostError: error instanceof Error ? error.message : String(error), usage: 'node node.mjs [file] [encoding|auto] [format|auto] [track-id|auto]' }));
  process.exitCode = 2;
}
