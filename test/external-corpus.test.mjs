import test from 'node:test';
import assert from 'node:assert/strict';
import {parse,decode} from '../dist/index.js';
import {verifyCorpus,wptText,realFiles,manifest,root} from '../research/quality-013/corpus.mjs';
import {checkedWptCases,realOracle,preservedWptTextDifferences} from '../research/quality-013/oracles.mjs';
import {readFileSync} from 'node:fs';
test('upstream corpus bytes match pinned SHA-256 provenance manifest',()=>verifyCorpus());
for(const f of checkedWptCases().filter(f=>f.assertions.length))test(`WPT literal cue assertions: ${f.id}`,()=>{
  const r=parse(f.source,{format:'vtt'}),cues=r.cues.map(c=>({startTime:c.start/1000,endTime:c.end/1000,text:c.rawText,id:c.id??''}));
  if(f.id==='timings-negative.test'){
    // WPT accepts these four DOM cues. Our safe-interval contract excludes them.
    assert.equal(cues.length,0);assert.ok(r.diagnostics.some(d=>d.code==='INVALID_INTERVAL'));assert.equal(r.sourceText,f.source);return;
  }
  for(const a of f.assertions)assert.deepEqual(a.index===null?cues.length:cues[a.index]?.[a.property],a.expected,JSON.stringify(a));
});
for(const f of wptText())test(`WPT text ${f.id}${preservedWptTextDifferences.has(f.id)?' (declared preservation difference)':''}`,()=>{
  const r=parse(f.source,{format:'vtt'});
  if(preservedWptTextDifferences.has(f.id)) {
    assert.equal(r.sourceText,f.source);assert.equal(r.status,'partial');
    assert.ok(r.diagnostics.some(d=>['UNKNOWN_MARKUP','UNTERMINATED_MARKUP'].includes(d.code)));
  }else assert.equal(r.cues[0]?.text??'',f.expected);
});
for(const r of manifest.records.filter(r=>r.path.includes('/file-parsing/support/')&&r.path.endsWith('.vtt')))test(`WPT invalid signature: ${r.path.split('/').at(-1)}`,()=>{
  const source=readFileSync(new URL(r.path,root),'utf8'),p=parse(source,{format:'vtt'});
  assert.equal(p.status,'fatal');assert.ok(p.diagnostics.some(d=>d.code==='VTT_SIGNATURE'));assert.equal(p.sourceText,source);
});
for(const f of realFiles())test(`Blender real file: ${f.id}`,()=>{
  const decoded=decode(f.bytes);assert.equal(decoded.text,f.source);assert.equal(decoded.encoding,f.encoding);
  const r=parse(f.source,{format:'srt'}),oracle=realOracle(f);
  assert.equal(r.sourceText,f.source);
  if(oracle.expected)assert.deepEqual(r.cues.map(c=>[c.start,c.end,c.rawText]),oracle.expected,oracle.basis);
  else {assert.equal(r.status,'partial');assert.ok(r.diagnostics.some(d=>d.severity==='error'));}
});
