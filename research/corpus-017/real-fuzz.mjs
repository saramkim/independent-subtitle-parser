// Mutation invariants on full-size originals; no mutated text is a conformance oracle.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse,detectFormat} from '../../dist/index.js';
const manifest=JSON.parse(readFileSync(new URL('./local-manifest.json',import.meta.url)));
const root=fileURLToPath(new URL('../../',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
if(process.argv[2]==='worker'){
 const file=manifest.records[Number(process.argv[3])],bytes=readFileSync(resolve(root,file.path));assert.equal(hash(bytes),file.sha256);
 const original=new TextDecoder(file.encoding,{fatal:true}).decode(bytes);
 let seed=(0x017ac004+Number(process.argv[3]))>>>0;
 const next=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0;
 const tokens=['\0','\r\n','{\\p1}','{\\t(0,999,\\p1)}','}','\\','00:60:60.99','99999999999999999999','[Events]\nFormat: Text,Start,End','<ShowImg="','👩🏽‍💻','\ud800'];
 const statuses={};let maxMs=0,maxHeap=0,maxRss=0;
 for(let i=0;i<128;i++){
  const at=next()%(original.length+1),token=tokens[next()%tokens.length];
  let source;
  switch(i%4){
   case 0:source=original.slice(0,at)+token+original.slice(at);break;
   case 1:source=original.slice(0,at)+original.slice(at+1+next()%1000);break;
   case 2:source=original.slice(0,at);break;
   case 3:source=original.slice(0,at)+token.repeat(4096)+original.slice(at);break;
  }
  try{
   const start=performance.now();let r=parse(source,{format:file.format,limits:{maxDiagnostics:32}});maxMs=Math.max(maxMs,performance.now()-start);
   assert.equal(r.sourceText,source);assert.ok(r.diagnostics.length<=32);
   statuses[r.status]=(statuses[r.status]??0)+1;
   if(r.status==='fatal')assert.deepEqual([r.cues,r.tracks,r.metadata],[[],[],[]]);
   const tracks=new Set(r.tracks.map(t=>t.id));assert.equal(tracks.size,r.tracks.length);
   for(const c of r.cues){assert.ok(Number.isSafeInteger(c.start)&&c.start>=0);assert.ok(c.end===null||Number.isSafeInteger(c.end)&&c.end>c.start);assert.ok(tracks.has(c.trackId));}
   if(i%16===0)assert.doesNotThrow(()=>detectFormat(source));
   const m=process.memoryUsage();maxHeap=Math.max(maxHeap,m.heapUsed);maxRss=Math.max(maxRss,m.rss);r=null;
  }catch(error){writeFileSync(resolve(process.argv[4],`failure-${process.argv[3]}-${i}.json`),JSON.stringify({id:file.id,iteration:i,seed,source,error:String(error)}),{flag:'wx'});throw error;}
 }
 console.log(JSON.stringify({id:file.id,originalSha256:file.sha256,mutations:128,statuses,maxMs,maxHeap,maxRss}));
}else{
 if(!process.argv[2])throw Error('Usage: node research/corpus-017/real-fuzz.mjs <new-output-directory>');
 const output=resolve(process.argv[2]);mkdirSync(output);
 const start=Date.now(),rows=[];
 for(let i=0;i<manifest.records.length;i++){
  const r=spawnSync(process.execPath,['--max-old-space-size=256',fileURLToPath(import.meta.url),'worker',String(i),output],{encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:1024*1024});
  assert.equal(r.status,0,r.stderr||String(r.error));rows.push(JSON.parse(r.stdout));console.log(rows.at(-1));
 }
 writeFileSync(resolve(output,'result.json'),JSON.stringify({node:process.version,durationSeconds:(Date.now()-start)/1000,oldSpaceMiB:256,workerTimeoutMs:120000,seed:'0x017ac004 + file index; LCG 1664525/1013904223',rows},null,2)+'\n',{flag:'wx'});
}
