// Real esbuild browser-target bundle of an installed npm tarball. Execution in
// a Node vm is an import/isolation check, not a native-browser compatibility claim.
import { build, version } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { formatCases } from '../quality-013/format-cases.mjs';
import { loadUpstreamCases } from './oracles.mjs';
const [consumerPath, output] = process.argv.slice(2);
if (!consumerPath || !output) throw Error('Usage: bundle-consumer.mjs <consumer-directory> <new-report.json>');
const consumer = resolve(consumerPath);
const packed = JSON.parse(readFileSync(resolve(consumer, 'package-evidence.json')));
const result = await build({
  stdin: { contents: "export { parse, decode, detectFormat, DEFAULT_LIMITS } from 'independent-subtitle-parser';", resolveDir: consumer, sourcefile: 'consumer.js' },
  bundle: true, platform: 'browser', target: 'es2022', format: 'iife',
  globalName: 'SubtitleParser', write: false, metafile: true, minify: true,
});
assert.equal(result.warnings.length, 0);
assert.ok(Object.keys(result.metafile.inputs).some(p => p.endsWith('dist/index.js')));
assert.ok(Object.values(result.metafile.inputs).every(f => f.imports.every(i => !i.external)));
const script = result.outputFiles[0].text;
// No process, Buffer, require, window, document, filesystem or extension APIs.
const context = { TextDecoder, TextEncoder };
runInNewContext(script, context, { timeout: 10000 });
const cases = [
  { id: 'literal-srt', format: 'srt', source: '1\n00:00:01,250 --> 00:00:03,500\n안녕\nHello', expected: [[1250, 3500, '안녕\nHello']] },
  { id: 'literal-vtt', format: 'vtt', source: 'WEBVTT\n\n00:01.250 --> 00:03.500\n<v Speaker>Hello</v>', expected: [[1250, 3500, 'Hello']] },
  ...formatCases, ...loadUpstreamCases(),
];
for (const c of cases) {
  const actual = context.SubtitleParser.parse(c.source, { format: c.format });
  assert.equal(JSON.stringify(actual.cues.map(cue => [cue.start, cue.end, cue.text])), JSON.stringify(c.expected), c.id ?? c.path);
}
assert.equal(context.SubtitleParser.decode(Uint8Array.of(128), { encoding: 'windows-1252' }).text, '€');
const report = { status: 'PASS', at: new Date().toISOString(), node: process.version,
  bundler: `esbuild@${version}`, target: 'browser/es2022',
  execution: 'Node vm without DOM/Node globals; not a native-browser result',
  tarballSha256: packed.tarballSha256, bundledBytes: result.outputFiles[0].contents.length,
  bundleSha256: createHash('sha256').update(script).digest('hex'), cases: cases.length,
  metafile: result.metafile };
writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ ...report, metafile: undefined }, null, 2));
