// Independent, deliberately restricted fixture transcription. No candidate or
// comparator imports. Review source rules/anchors before running comparisons.
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const manifest=JSON.parse(readFileSync('corpus/corpus-016/manifest.json'));
const clock = value => {
 assert.match(value,/^\d+:\d{1,2}:\d{1,2}\.\d{2}$/);
 const [h,m,s]=value.split(':'); const [seconds,centiseconds]=s.split('.');
 return Number(h)*3600000+Number(m)*60000+Number(seconds)*1000+Number(centiseconds)*10;
};
const records=manifest.records.filter(r=>r.format).map(record=>{
 const source=readFileSync(record.path,'utf8');
 if(record.format==='sami')return {id:record.id,basis:'Literal source transcription; a missing class does not clear another language; final end unknown.',
  tracks:[['ENCC','English','en-US','CC'],['KRCC','Korean','ko-KR','CC']],
  cues:[
   [1000,3500,'Welcome to SAMI subtitle example','ENCC'],
   [3500,6000,'This format is widely used in Asia','ENCC'],
   [6000,11000,'Especially in Korean and Chinese markets','ENCC'],
   [9000,null,'안녕하세요','KRCC'],
   [11000,14000,'SAMI supports multi-language subtitles','ENCC'],
   [14000,16500,'And HTML-like styling','ENCC'],
   [16500,null,'Thank you for watching!','ENCC'],
  ]};
 const cues=[],rejected=[],comments=[];
 const lines=source.split(/\r\n|\n|\r/);
 assert.ok(lines.some(line=>line==='Format: '+(record.format==='ssa'?'Marked':'Layer')+', Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'));
 for(const [index,line] of lines.entries()) {
  if(line.startsWith('Comment:')){comments.push(line);continue;}
  if(!line.startsWith('Dialogue:'))continue;
  const fields=line.slice('Dialogue: '.length).split(',');
  assert.ok(fields.length>=10);
  const start=clock(fields[1]),end=clock(fields[2]),raw=fields.slice(9).join(',');
  // These particular samples contain only non-text-changing overrides. Refuse
  // drawing/wrap semantics rather than growing a second general ASS parser.
  // A style reset in these samples has no drawing/wrap state to reset.
  assert.doesNotMatch(raw,/\\(?:p|q)\d|\\[nh{}]/);
  const text=raw.replace(/\{[^}]*\}/g,'').replaceAll('\\N','\n');
  assert.doesNotMatch(text,/[{}\\]/);
  if(end<=start)rejected.push(line);
  else cues.push({start,end,text,rawText:raw,line:index+1,fields:fields.slice(0,9)});
 }
 return {id:record.id,basis:'Source Dialogue lines; h*3600000+m*60000+s*1000+cs*10; overrides nonspoken, hard breaks preserved. Nonpositive intervals retained as rejected metadata by the documented package policy.',cues,rejected,comments};
});
// Literal checks independent of the transcription loop, including the real
// one-digit seconds spelling 0:00:7.00 in libjass's transition test.
assert.deepEqual(records.find(r=>r.id==='libjass/tests/functional/t/alpha.ass').cues.map(c=>[c.start,c.end,c.text]),
 [[0,7000,'test'],[900,1100,'test'],[1900,2100,'test'],[2900,3100,'test'],[3900,4100,'test'],[4900,5100,'test'],[5900,6100,'test']]);
assert.deepEqual(records.find(r=>r.id==='libjass/tests/functional/kfx/kfx.ass').cues.map(c=>[c.start,c.end,c.text]),[[1000,7000,'abcd']]);
assert.deepEqual(records.find(r=>r.id==='subtitleedit/test.ssa').cues.map(c=>[c.start,c.end,c.text]),[[1000,4000,'Hello, World!'],[5000,8000,'This is a test subtitle.'],[10000,13000,'Testing SeConv subtitle converter.']]);
writeFileSync('corpus/corpus-016/expected.json',JSON.stringify({basis:'Authored before candidate evaluation. This is fixture transcription, not majority voting or renderer conformance.',records},null,2)+'\n',{flag:'wx'});
console.log(`Transcribed ${records.length} independent oracles`);
