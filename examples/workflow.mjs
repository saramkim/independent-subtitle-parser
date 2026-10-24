// Consumer recipe, not a package export. No filename-based format guessing.
import { decode, parse } from '../dist/index.js';

export const MAX_FILE_BYTES = 16 * 1024 * 1024;

export function readSubtitle(bytes, { encoding, format, replacement = false } = {}) {
  const decoded = decode(bytes, { encoding, fatal: !replacement, maxBytes: MAX_FILE_BYTES });
  const parsed = decoded.text === null ? null : parse(decoded.text, { format });
  return {
    options: { encoding: encoding ?? null, format: format ?? null, replacement },
    encoding: decoded.encoding,
    bom: decoded.bom,
    decodeDiagnostics: decoded.diagnostics,
    parsed,
    diagnostics: [
      ...decoded.diagnostics.map(d => ({ ...d, stage: 'decode' })),
      ...(parsed?.diagnostics ?? []).map(d => ({ ...d, stage: 'parse' })),
    ],
  };
}

// IDs come from result.tracks; language tags may be absent or duplicated.
export function selectTrack(result, trackId) {
  if (!result || result.status === 'fatal') throw new Error('No usable parse result.');
  if (!result.tracks.some(track => track.id === trackId)) throw new Error('Unknown track ID.');
  return result.cues.filter(cue => cue.trackId === trackId);
}

export function formatTime(ms) {
  if (ms === null) return 'unknown';
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor(ms / 60_000) % 60;
  const seconds = Math.floor(ms / 1000) % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}
