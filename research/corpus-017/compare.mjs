import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {parse,decode,detectFormat} from '../../dist/index.js';
const manifest=JSON.parse(readFileSync(new URL('./local-manifest.json',import.meta.url)));
const expected=JSON.parse(readFileSync(process.argv[2]));
const require=createRequire(new URL('../quality-013/package.json',import.meta.url)),ass=require('ass-compiler'),subsrt=require('subsrt');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rows=[];
for(const file of manifest.records){
 const bytes=readFileSync(new URL('../../'+file.path,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);
 const source=decode(bytes,{encoding:file.encoding}).text;assert.notEqual(source,null);
 const e=expected.records.find(r=>r.id===file.id);
 const want=e.rows.map(c=>[c.start,c.end,c.raw]);
 const begin=performance.now(),result=parse(source,{format:file.format}),ms=performance.now()-begin;
 assert.notEqual(result.status,'fatal');assert.equal(result.sourceText,source);
 const errors=[];
 if(result.cues.length!==e.rows.length)errors.push('count');
 for(let i=0;i<Math.max(result.cues.length,e.rows.length);i++){
  const a=result.cues[i],b=e.rows[i];if(!a||!b)continue;
  if(JSON.stringify([a.start,a.end,a.rawText,a.fields,a.source.line])!==JSON.stringify([b.start,b.end,b.raw,b.fields,b.line]))errors.push(`raw/time/fields/line:${i}`);
  if(b.text!==null&&a.text!==b.text)errors.push(`text:${i}`);
 }
 assert.deepEqual(result.metadata.filter(m=>m.kind==='ass-rejected-event').map(m=>m.raw),e.rejected);
 assert.deepEqual(result.metadata.filter(m=>m.kind==='ass-comment').map(m=>m.raw),e.comments);
 assert.equal(detectFormat(source).format,file.format);
 const comparison=[];
 for(const [name,run]of [
  ['ass-compiler@0.1.16',()=>ass.parse(source).events.dialogue.map(c=>[Math.round(c.Start*1000),Math.round(c.End*1000),c.Text.raw])],
  ['subsrt@1.1.1',()=>subsrt.parse(source,{format:file.format,eol:'\n'}).filter(c=>c.type==='caption').map(c=>[c.start,c.end,c.content])]
 ])try{
  const actual=run(),differences={missing:0,extra:0,timing:0,trimOnly:0,otherRaw:0};
  for(let i=0;i<Math.max(actual.length,want.length);i++){
   const a=actual[i],b=want[i];
   if(!a){differences.missing++;continue;}if(!b){differences.extra++;continue;}
   if(a[0]!==b[0]||a[1]!==b[1])differences.timing++;
   if(a[2]!==b[2]){if(a[2]===b[2].trim())differences.trimOnly++;else differences.otherRaw++;}
  }
  comparison.push({name,dimension:'time/raw-text',count:actual.length,matches:hash(actual)===hash(want),differences,sha256:hash(actual)});
 }catch(error){comparison.push({name,error:String(error)});}
 const row={id:file.id,format:file.format,bytes:bytes.length,cues:result.cues.length,readingScored:e.rows.filter(r=>r.text!==null).length,rejected:e.rejected.length,comments:e.comments.length,firstStart:e.rows[0].start,lastSourceEventEnd:e.rows.at(-1).end,maxEnd:Math.max(...e.rows.map(r=>r.end)),ms,errors,diagnostics:[...new Set(result.diagnostics.map(d=>d.code))],diagnosticsTruncated:result.diagnosticsTruncated,comparison,expectedSha256:hash(want)};
 rows.push(row);console.log({...row,comparison:undefined});
}
writeFileSync(process.argv[3],JSON.stringify({node:process.version,platform:process.platform,rows},null,2)+'\n',{flag:'wx'});
if(rows.some(r=>r.errors.length))process.exitCode=1;
