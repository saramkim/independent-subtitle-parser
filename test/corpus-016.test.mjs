import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse, detectFormat, decode } from '../dist/index.js';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('corpus/corpus-016/manifest.json',root)));
const expected=JSON.parse(readFileSync(new URL('corpus/corpus-016/expected.json',root)));
test('expanded ASS/SSA/SAMI originals retain pinned bytes and licenses',()=>{
 for(const r of manifest.records){const b=readFileSync(new URL(r.path,root));assert.equal(b.length,r.bytes,r.id);assert.equal(createHash('sha256').update(b).digest('hex'),r.sha256,r.id);}
});
for(const record of manifest.records.filter(r=>r.format))test(`independent upstream oracle: ${record.id}`,()=>{
 const bytes=readFileSync(new URL(record.path,root));
 const decoded=decode(bytes,{encoding:record.encoding});
 assert.notEqual(decoded.text,null);
 const source=decoded.text,result=parse(source,{format:record.format});
 const oracle=expected.records.find(r=>r.id===record.id);
 assert.equal(result.sourceText,source);
 assert.notEqual(result.status,'fatal');
 if(record.format==='sami'){
  assert.deepEqual(result.cues.map(c=>[c.start,c.end,c.text,result.tracks.find(t=>t.id===c.trackId).sourceClass]),oracle.cues);
  assert.deepEqual(result.tracks.map(t=>[t.sourceClass,t.label,t.language,t.kind]),oracle.tracks);
 }else{
  assert.deepEqual(result.cues.map(c=>({start:c.start,end:c.end,text:c.text,rawText:c.rawText,line:c.source.line,fields:c.fields.slice(0,9).map(f=>f.value)})),oracle.cues);
  assert.deepEqual(result.metadata.filter(m=>m.kind==='ass-rejected-event').map(m=>m.raw),oracle.rejected);
  assert.deepEqual(result.metadata.filter(m=>m.kind==='ass-comment').map(m=>m.raw),oracle.comments);
 }
 // Explicit and detected routes must agree when the detector has a decision.
 const detected=detectFormat(source);
 if(detected.format===record.format)assert.deepEqual(parse(source),result);
});

const ass=(start,end,text='sample')=>`[Script Info]\nScriptType: v4.00+\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
test('ASS short minute/second fields recover exact time with an explicit diagnostic',()=>{
 for(const [start,end,a,b] of [['0:00:0.00','0:00:7.00',0,7000],['1:2:3.04','1:2:4.05',3723040,3724050]]){
  const r=parse(ass(start,end),{format:'ass'});
  assert.deepEqual(r.cues.map(c=>[c.start,c.end]),[[a,b]]);
  assert.equal(r.status,'partial');
  assert.ok(r.diagnostics.some(d=>d.code==='ASS_TIME_WIDTH_RECOVERED'));
 }
});
test('ASS fractional precision remains strict: .766 is not silently interpreted as milliseconds',()=>{
 const r=parse(ass('0:00:00.00','0:00:03.766'),{format:'ass'});
 assert.equal(r.cues.length,0);
 assert.ok(r.diagnostics.some(d=>d.code==='ASS_INVALID_TIME'));
 assert.ok(r.metadata.some(m=>m.kind==='ass-rejected-event'&&m.raw.includes('03.766')));
});
test('SAMI legacy SAMI_Type preserves track kind alongside SAMIType',()=>{
 const r=parse('<SAMI><STYLE>.EN {Name: English; lang: en-US; SAMI_Type: CC;}.KO {lang: ko; SAMIType: CC;}</STYLE><SYNC Start=0><P Class=EN>Hello<P Class=KO>안녕</SAMI>');
 assert.deepEqual(r.tracks.map(t=>t.kind),['CC','CC']);
});
test('SAMI Source ID projection discloses its unapplied persistent speaker semantics',()=>{
 const r=parse('<SAMI><STYLE>#Source {color: red;}</STYLE><SYNC Start=0><P Class=EN ID=Source>Narrator<P Class=EN>First<SYNC Start=1000><P Class=EN ID=SOURCE>Other<P Class=EN>Second</SAMI>');
 assert.equal(r.diagnostics.filter(d=>d.code==='SAMI_SOURCE_ID_UNAPPLIED').length,1);
 assert.equal(r.status,'partial');
 assert.ok(r.cues[0].fields.some(f=>f.name==='p.0.id'&&f.value==='Source'));
 assert.deepEqual(r.cues.map(c=>[c.start,c.end,c.text]),[[0,1000,'Narrator\nFirst'],[1000,null,'Other\nSecond']]);
});
