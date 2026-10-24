// Independent writer integration: expectations are derived from the ORIGINAL
// SRT clock/payload oracle, before invoking the pinned upstream serializer.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { parse } from '../../dist/index.js';
import { realFiles } from '../quality-013/corpus.mjs';
import { realOracle } from '../quality-013/oracles.mjs';
const require = createRequire(new URL('../quality-013/package.json', import.meta.url));
const subsrt = require('subsrt');
const rows = [];
for (const f of realFiles().filter(f => /TOS-(en|JP|HE|ru)\.srt$/.test(f.id))) {
  const input = realOracle(f).expected;
  // These selected sources contain no markup needing a candidate text projector.
  if (input.some(c => /[<>{}\\&]/.test(c[2]))) throw Error('Source requires independent adjudication: ' + f.id);
  for (const format of ['ass', 'ssa', 'smi']) {
    const source = subsrt.build(input.map(([start, end, text]) => ({ start, end, text })), { format });
    // ASS/SSA stores centiseconds; this pinned writer floors the final ms digit.
    const clock = n => format === 'smi' ? n : Math.floor(n / 10) * 10;
    const expected = input.map(([s, e, t]) => [clock(s), clock(e), format === 'smi' ? t.replace(/[ \t\f\r]+/g, ' ').replace(/ *\n */g, '\n').trim() : t]);
    const actual = parse(source, { format: format === 'smi' ? 'sami' : format });
    const output = actual.cues.map(c => [c.start, c.end, c.text]);
    rows.push({ input: f.id, writer: 'subsrt@1.1.1', format, source, expected, actual: output, diagnostics: actual.diagnostics, matches: JSON.stringify(output) === JSON.stringify(expected) });
  }
}
writeFileSync(process.argv[2], JSON.stringify({ node: process.version, note: 'Twelve derived exports of four translations of one film, not twelve independent original production files. No candidate output defines expectations.', rows }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(rows.map(({ input, format, matches, actual }) => ({ input, format, matches, cues: actual.length })), null, 2));
if (rows.some(r => !r.matches)) process.exitCode = 1;
