import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { parse,decode,detectFormat } from '../../dist/index.js';
const root=new URL('../../',import.meta.url),json=p=>JSON.parse(readFileSync(new URL(p,root)));
const ref=createRequire(new URL('../quality-013/package.json',import.meta.url));
const subsrt=ref('subsrt'),ass=ref('ass-compiler');
const manifests=[json('corpus/corpus-016/manifest.json'),json('research/corpus-016/local-manifest.json')];
const expected=[json('corpus/corpus-016/expected.json'),JSON.parse(readFileSync(process.argv[2]))];
const rows=[];
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function observation(parser,dimension,actual,want){
  const mismatch=[];
  for(let i=0;i<Math.max(actual.length,want.length);i++)if(JSON.stringify(actual[i])!==JSON.stringify(want[i]))mismatch.push(i);
  return {parser,dimension,count:actual.length,expectedCount:want.length,mismatchCount:mismatch.length,firstMismatch:mismatch[0]??null,matchesExpected:!mismatch.length,actualSha256:hash(actual),expectedSha256:hash(want)};
}
for(let dataset=0;dataset<2;dataset++)for(const record of manifests[dataset].records.filter(r=>r.format)){
  const bytes=readFileSync(new URL(record.path,root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);
  const decoded=decode(bytes,{encoding:record.encoding});assert.notEqual(decoded.text,null);
  const source=decoded.text;
  assert.equal(source,new TextDecoder(record.encoding,{fatal:true}).decode(bytes));
  const oracle=expected[dataset].records.find(r=>r.id===record.id);
  if(oracle.unscoredReason){
    const own=parse(source,{format:record.format});
    assert.equal(own.sourceText,source);assert.notEqual(own.status,'fatal');
    assert.ok(own.diagnostics.some(d=>['SAMI_MALFORMED_TAG','SAMI_LEGACY_COMMAND_UNAPPLIED'].includes(d.code)));
    const observations=[{parser:'candidate',scored:false,count:own.cues.length}];
    try {observations.push({parser:'subsrt@1.1.1',scored:false,count:subsrt.parse(source,{format:'smi'}).filter(c=>c.type==='caption').length});}
    catch(error){observations.push({parser:'subsrt@1.1.1',scored:false,error:String(error)});}
    rows.push({id:record.id,localOnly:true,format:record.format,encoding:record.encoding,bytes:bytes.length,unscoredReason:oracle.unscoredReason,status:own.status,diagnostics:[...new Set(own.diagnostics.map(d=>d.code))],observations});continue;
  }
  const cues=oracle.cues.map(c=>Array.isArray(c)?{start:c[0],end:c[1],text:c[2],cls:c[3]}:{...c,raw:c.raw??c.rawText});
  const textScored=oracle.textScored!==false,dimension=textScored?'time/reading-text':'time-only';
  const tuple=c=>textScored?[c.start,c.end,c.text]:[c.start,c.end];
  const want=cues.map(tuple),own=parse(source,{format:record.format});
  const observations=[observation('candidate',dimension,own.cues.map(tuple),want)];
  if(record.format==='sami')observations.push(observation('candidate','class/timeline',own.cues.map(c=>[c.start,c.end,own.tracks.find(t=>t.id===c.trackId).sourceClass??'']),cues.map(c=>[c.start,c.end,c.cls])));
  else {
    observations.push(observation('candidate','time/raw-text',own.cues.map(c=>[c.start,c.end,c.rawText]),cues.map(c=>[c.start,c.end,c.raw])));
    assert.deepEqual(own.metadata.filter(m=>m.kind==='ass-rejected-event').map(m=>m.raw),oracle.rejected,record.id);
  }
  try{
    const actual=subsrt.parse(source,{format:record.format==='sami'?'smi':record.format,eol:'\n'}).filter(c=>c.type==='caption');
    observations.push(observation('subsrt@1.1.1',dimension,actual.map(tuple),want));
  }catch(error){observations.push({parser:'subsrt@1.1.1',error:String(error)});}
  if(record.format!=='sami')try{
    const actual=ass.parse(source).events.dialogue.map(c=>[Math.round(c.Start*1000),Math.round(c.End*1000),c.Text.raw]);
    observations.push(observation('ass-compiler@0.1.16','time/raw-text',actual,cues.map(c=>[c.start,c.end,c.raw])));
  }catch(error){observations.push({parser:'ass-compiler@0.1.16',error:String(error)});}
  assert.equal(own.sourceText,source);
  const auto=detectFormat(source);
  if(auto.format===record.format)assert.deepEqual(parse(source),own);
  rows.push({id:record.id,localOnly:!!dataset,format:record.format,encoding:record.encoding,bytes:bytes.length,detected:auto.format,status:own.status,diagnostics:[...new Set(own.diagnostics.map(d=>d.code))],rejected:oracle.rejected?.length??0,observations});
}
writeFileSync(process.argv[3],JSON.stringify({node:process.version,platform:process.platform,note:'No overall ranking. Positive-interval/strict centisecond and SAMI unknown-end policies differ between libraries; rendering and layout are unscored. Related exports are not independent works. Hashes avoid redistributing local-only transcripts.',rows},null,2)+'\n',{flag:'wx'});
const failures=rows.flatMap(r=>r.observations.filter(o=>o.parser==='candidate'&&o.scored!==false&&!o.matchesExpected).map(o=>({id:r.id,...o})));
console.log(JSON.stringify({files:rows.length,candidateFailures:failures,summary:['candidate','subsrt@1.1.1','ass-compiler@0.1.16'].map(parser=>({parser,files:rows.filter(r=>r.observations.some(o=>o.parser===parser)).length,matchingFiles:rows.filter(r=>r.observations.filter(o=>o.parser===parser).length&&r.observations.filter(o=>o.parser===parser).every(o=>o.matchesExpected)).length}))},null,2));
if(failures.length)process.exitCode=1;
