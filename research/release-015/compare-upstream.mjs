import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { parse } from '../../dist/index.js';
import { loadUpstreamCases } from './oracles.mjs';
const require = createRequire(new URL('../quality-013/package.json', import.meta.url));
const subsrt = require('subsrt'), ass = require('ass-compiler');
const rows = loadUpstreamCases().map(c => {
  const own = parse(c.source, { format: c.format });
  const observations = [{ parser: 'candidate', dimension: 'reading-text', expected: c.expected,
    actual: own.cues.map(c => [c.start, c.end, c.text]), diagnostics: own.diagnostics }];
  try {
    const r = subsrt.parse(c.source, { format: c.format === 'sami' ? 'smi' : c.format, eol: '\n' });
    observations.push({ parser: 'subsrt@1.1.1', dimension: 'reading-text', expected: c.expected,
      actual: r.filter(c => c.type === 'caption').map(c => [c.start, c.end, c.text]) });
  } catch (error) { observations.push({ parser: 'subsrt@1.1.1', error: String(error) }); }
  if (c.raw) try {
    const r = ass.parse(c.source);
    observations.push({ parser: 'ass-compiler@0.1.16', dimension: 'time/raw-text',
      expected: c.expected.map(([s, e], i) => [s, e, c.raw[i]]),
      actual: r.events.dialogue.map(c => [Math.round(c.Start * 1000), Math.round(c.End * 1000), c.Text.raw]) });
  } catch (error) { observations.push({ parser: 'ass-compiler@0.1.16', error: String(error) }); }
  for (const o of observations) if (!o.error) o.matchesExpected = JSON.stringify(o.actual) === JSON.stringify(o.expected);
  return { path: c.path, observations };
});
writeFileSync(process.argv[2], JSON.stringify({ node: process.version, rows,
  note: 'Three small upstream samples, not an overall ranking. Reading text and ASS raw syntax are separate dimensions. Unknown SAMI final ends remain null in the independent oracle.' }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(rows, null, 2));
if (rows.some(r => !r.observations[0].matchesExpected)) process.exitCode = 1;
