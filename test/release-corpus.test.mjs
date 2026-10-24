import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from '../dist/index.js';
import { loadUpstreamCases } from '../research/release-015/oracles.mjs';
test('release corpus matches fixed upstream bytes and license records', () => {
  const manifest = JSON.parse(readFileSync('corpus/release-015/manifest.json'));
  for (const entry of manifest.records) {
    const bytes = readFileSync(entry.path);
    assert.equal(bytes.length, entry.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    assert.match(entry.revision, /^[0-9a-f]{40}$/);
  }
});
for (const c of loadUpstreamCases()) test(`upstream extraction oracle: ${c.path}`, () => {
  const result = parse(c.source);
  assert.equal(result.format, c.format);
  assert.deepEqual(result.cues.map(cue => [cue.start, cue.end, cue.text]), c.expected);
  assert.equal(result.sourceText, c.source);
  if (c.raw) assert.deepEqual(result.cues.map(cue => cue.rawText), c.raw);
  if (c.format === 'sami') {
    assert.deepEqual(result.tracks, [{ id: 'sami:class:ENUSCC', sourceClass: 'ENUSCC', label: 'English Captions', language: 'en-US', kind: 'CC' }]);
    assert.ok(result.diagnostics.some(d => d.code === 'SAMI_OPEN_ENDED_CUE'));
  }
});
