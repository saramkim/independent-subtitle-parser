// One controlled transformation to test a source-inspected comparator failure.
// The original corpus is never rewritten; this is not a replacement test oracle.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../quality-013/package.json', import.meta.url));
const subsrt = require('subsrt');
const source = readFileSync('corpus/release-015/microsoft/ccsample.smi', 'utf8');
const parserSource = readFileSync(require.resolve('subsrt/lib/format/smi.js'));
const projected = source.replace(/(<SYNC\b[^>]*>)[\t\n\r ]+(?=<P\b)/gi, '$1');
const count = input => subsrt.parse(input, { format: 'smi', eol: '\n' }).filter(c => c.type === 'caption');
const original = count(source), adjusted = count(projected);
assert.equal(original.length, 0); assert.equal(adjusted.length, 12);
writeFileSync(process.argv[2], JSON.stringify({
  parser: 'subsrt@1.1.1', parserSourceSha256: createHash('sha256').update(parserSource).digest('hex'),
  originalCues: original.length, adjustedCues: adjusted.length,
  transformation: 'Remove only ASCII whitespace between SYNC opening tag and P opening tag in an in-memory copy.',
  finding: 'The anchored P regexp fails when caption.content starts with indentation/newline. The controlled change recovers all 12 paragraph records.',
  adjustedFinalEnd: adjusted.at(-1).end,
  caveat: 'This diagnoses a particular version/input. A recovered count does not prove equal text/timing semantics; its invented final duration remains a policy difference.',
}, null, 2) + '\n', { flag: 'wx' });
