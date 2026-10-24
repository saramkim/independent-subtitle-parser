import { readFileSync } from 'node:fs';
import { parse } from '../../dist/index.js';
import { parseSync } from 'subtitle';
import { parse as parsePlus } from '@plussub/srt-vtt-parser';
import { parseText } from 'media-captions';
import webvttParser from 'webvtt-parser';
import { fixtures } from './fixtures.mjs';

const dependencies = JSON.parse(readFileSync(new URL('package.json', import.meta.url))).dependencies;
const packageVersion = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url))).version;
const adapters = [
  { name: 'independent-subtitle-parser', version: packageVersion, formats: ['srt', 'vtt', 'ass'], run(source, format) {
    const result = parse(source, { format });
    return { cues: result.cues.map(c => [c.start, c.end, c.rawText]), diagnostics: result.diagnostics };
  } },
  { name: 'subtitle', formats: ['srt', 'vtt'], run(source) {
    return { cues: parseSync(source).filter(n => n.type === 'cue').map(n => [n.data.start, n.data.end, n.data.text]) };
  } },
  { name: '@plussub/srt-vtt-parser', formats: ['srt', 'vtt'], run(source) {
    return { cues: parsePlus(source).entries.map(c => [c.from, c.to, c.text]) };
  } },
  { name: 'media-captions', formats: ['srt', 'vtt', 'ass'], async run(source, format) {
    const result = await parseText(source, { type: format, errors: true });
    return { cues: result.cues.map(c => [Math.round(c.startTime * 1000), Math.round(c.endTime * 1000), c.text]), diagnostics: result.errors };
  } },
  { name: 'webvtt-parser', formats: ['vtt'], run(source) {
    const result = new webvttParser.WebVTTParser().parse(source);
    return { cues: result.cues.map(c => [Math.round(c.startTime * 1000), Math.round(c.endTime * 1000), c.text]), diagnostics: result.errors };
  } },
];
const cases = [];
for (const fixture of fixtures) {
  const observations = [];
  for (const adapter of adapters) {
    if (!adapter.formats.includes(fixture.format)) continue;
    try {
      const actual = await adapter.run(fixture.source, fixture.format);
      observations.push({ parser: adapter.name, version: adapter.version ?? dependencies[adapter.name],
        matchesExpectedCues: JSON.stringify(actual.cues) === JSON.stringify(fixture.expected), ...actual });
    } catch (error) { observations.push({ parser: adapter.name, version: dependencies[adapter.name], error: String(error) }); }
  }
  cases.push({ ...fixture, observations });
}
console.log(JSON.stringify({ runAtUtc: new Date().toISOString(), node: process.version,
  scope: 'Focused synthetic cue time/raw-payload probes. Not a comprehensive correctness or performance ranking. Unsupported formats are omitted. Differing outputs require source-based judgment.',
  cases }, (_key, value) => typeof value === 'number' && !Number.isFinite(value) ? { nonFinite: String(value) } : value, 2));
if (cases.some(c => c.observations.find(o => o.parser === 'independent-subtitle-parser')?.matchesExpectedCues !== true)) process.exitCode = 1;
