import { performance } from 'node:perf_hooks';
import { parse } from '../dist/index.js';
const stamp = (ms, separator = '.') => `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}${separator}${String(ms % 1000).padStart(3, '0')}`;
const rows = [];
for (const count of [10_000, 50_000]) {
  const sources = {
    srt: Array.from({ length: count }, (_, i) => `${i + 1}\n${stamp(i * 1000, ',')} --> ${stamp(i * 1000 + 990, ',')}\n안녕 ${i}`).join('\n\n'),
    vtt: 'WEBVTT\n\n' + Array.from({ length: count }, (_, i) => `${stamp(i * 1000)} --> ${stamp(i * 1000 + 990)}\nHello ${i}`).join('\n\n'),
    ass: '[Script Info]\nScriptType: v4.00+\n[Events]\nFormat: Start, End, Text\n' + Array.from({ length: count }, (_, i) => `Dialogue: ${stamp(i * 1000).slice(0, -1)},${stamp(i * 1000 + 990).slice(0, -1)},مرحبا ${i}`).join('\n'),
    sami: '<SAMI>\n' + Array.from({ length: count }, (_, i) => `<SYNC Start=${i * 1000}><P Class=KO>안녕 ${i}\n`).join('') + `<SYNC Start=${count * 1000}><P Class=KO>&nbsp;</SAMI>`,
  };
  for (const [format, input] of Object.entries(sources)) {
    const samples = [];
    parse(input, { format });
    for (let run = 0; run < 3; run++) {
      const start = performance.now();
      const result = parse(input, { format });
      samples.push(performance.now() - start);
      if (result.cues.length !== count || result.status === 'fatal' || result.cues.at(-1).start !== (count - 1) * 1000 || result.cues.at(-1).end !== (format === 'sami' ? count * 1000 : (count - 1) * 1000 + 990)) throw new Error(`${format}: wrong cue count/endpoint/status`);
    }
    samples.sort((a, b) => a - b);
    rows.push({ format, count, utf16Units: input.length, medianMs: Math.round(samples[1] * 100) / 100, samplesMs: samples.map(ms => Math.round(ms * 100) / 100) });
  }
}
console.log(JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, note: 'Synthetic whole-document parsing; one warmup and three measured samples; no throughput guarantee. Memory is process-wide, not per-case peak.', rows, memory: process.memoryUsage() }, null, 2));
