import type { Detection } from './types.js';

/** Content-only heuristic, examining at most 64 Ki UTF-16 code units. No filename guessing. */
export function detectFormat(text: string): Detection {
  if (typeof text !== 'string') throw new TypeError('detectFormat expects a string.');
  const sample = text.slice(0, 65_536).replace(/^\uFEFF/, '');
  if (/^WEBVTT(?:[ \t\r\n]|$)/.test(sample)) return { format: 'vtt', confidence: 'high', candidates: ['vtt'] };
  let offset = 0;
  while (offset < sample.length) {
    while (offset < sample.length && /\s/.test(sample[offset]!)) offset++;
    if (!sample.startsWith('<!--', offset)) break;
    const end = sample.indexOf('-->', offset + 4);
    if (end < 0) break;
    offset = end + 3;
  }
  const leading = sample.slice(offset);
  if (/^<sami(?:\s|>)/i.test(leading)) return { format: 'sami', confidence: 'high', candidates: ['sami'] };
  if (/^\[(?:Script Info|Events|V4\+? Styles)\]/i.test(leading)) {
    const ssa = /(?:^|[\r\n])[ \t]*(?:ScriptType[ \t]*:[ \t]*v4\.00[ \t]*$|\[V4 Styles\])/im.test(sample);
    const ass = /(?:^|[\r\n])[ \t]*(?:ScriptType[ \t]*:[ \t]*v4\.00\+|\[V4\+ Styles\])/im.test(sample);
    if (ssa && ass) return { format: null, confidence: 'ambiguous', candidates: ['ass', 'ssa'] };
    return { format: ssa ? 'ssa' : 'ass', confidence: ass || ssa ? 'high' : 'low', candidates: [ssa ? 'ssa' : 'ass'] };
  }
  if (/(?:^|[\r\n])[ \t]*\d+:\d{2}:\d{2},\d{3}[ \t]+-->/.test(sample)) return { format: 'srt', confidence: 'high', candidates: ['srt'] };
  if (/(?:^|[\r\n])[ \t]*\d+:\d{2}:\d{2},\d{3}[ \t]+->/.test(sample)) return { format: 'srt', confidence: 'low', candidates: ['srt'] };
  if (/(?:^|[\r\n])[ \t]*(?:\d+:)?\d{2}:\d{2}\.\d{3}[ \t]+-->/.test(sample)) return { format: null, confidence: 'ambiguous', candidates: ['srt', 'vtt'] };
  if (/<sync\b[^<>]*\bstart\s*=/i.test(sample)) return { format: 'sami', confidence: 'low', candidates: ['sami'] };
  return { format: null, confidence: 'none', candidates: [] };
}
