import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../dist/index.js';
import { formatCases } from '../research/quality-013/format-cases.mjs';
for(const f of formatCases)test(f.id,()=>{
  const r=parse(f.source,{format:f.format});
  assert.deepEqual(r.cues.map(c=>[c.start,c.end,c.text]),f.expected,f.basis);
  assert.equal(r.sourceText,f.source);assert.notEqual(r.status,'fatal');
  if(f.tracks)assert.deepEqual(r.cues.map(c=>r.tracks.find(t=>t.id===c.trackId)?.sourceClass),f.tracks);
  if(f.rawExpected)assert.deepEqual(r.cues.map(c=>[c.start,c.end,c.rawText]),f.rawExpected);
});
