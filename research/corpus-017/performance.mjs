// Sequential isolated-process observations, not a universal performance claim.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const manifest=JSON.parse(readFileSync(new URL('./local-manifest.json',import.meta.url)));
const sami=JSON.parse(readFileSync(new URL('../corpus-016/local-manifest.json',import.meta.url)));
const counts={'ffmpeg/Intro_to_Message_Routing.smi':[56,58],'ffmpeg/Intro_to_SMTP_messaging.smi':[26,28],'ffmpeg/SAMI_Demo.smi':[46,48],'pbs/example.sami':[1847,1847]};
manifest.records.push(...sami.records.filter(r=>Object.hasOwn(counts,r.id)).map(r=>({...r,counts:counts[r.id]})));
for(const count of [10000,20000,40000])manifest.records.push({id:`synthetic-command-${count}`,format:'sami',count,counts:[count,count]});
if(process.argv[2]==='worker'){
 const {parse}=await import(pathToFileURL(resolve(process.argv[3])));
 const file=manifest.records[Number(process.argv[4])];
 const bytes=file.count?Buffer.from('<SAMI>'+Array.from({length:file.count},(_,i)=>`<SYNC Start=${i*1000}><P>x<SpanID:${i};>`).join('\n')+`<SYNC Start=${file.count*1000}></SAMI>`):readFileSync(resolve(root,file.path));
 if(file.sha256)assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);
 const source=new TextDecoder(file.encoding??'utf-8',{fatal:true}).decode(bytes);
 const expectedCount=file.counts?file.counts[process.argv[5]==='baseline016'?1:0]:source.split(/\r\n|\r|\n/).filter(l=>/^Dialogue:/i.test(l)).length;
 const times=[],postGc=[];let peakHeap=0,peakRss=0;
 global.gc();const initialHeap=process.memoryUsage().heapUsed;
 for(let i=0;i<18;i++){
  const start=performance.now();let result=parse(source,{format:file.format});const ms=performance.now()-start;
  assert.notEqual(result.status,'fatal');assert.equal(result.cues.length,expectedCount);
  const mem=process.memoryUsage();peakHeap=Math.max(peakHeap,mem.heapUsed);peakRss=Math.max(peakRss,mem.rss);
  if(i>=3)times.push(ms);
  result=null;global.gc();postGc.push(process.memoryUsage().heapUsed);
 }
 const sorted=[...times].sort((a,b)=>a-b);
 console.log(JSON.stringify({id:file.id,bytes:bytes.length,cues:expectedCount,ms:{median:sorted[7],p95:sorted[14],min:sorted[0],max:sorted.at(-1)},initialHeap,peakHeap,peakRss,resourceMaxRssKiB:process.resourceUsage().maxRSS,postGc,postWarmupHeapDelta:postGc.at(-1)-postGc[2]}));
}else{
 if(!process.argv[2])throw Error('Usage: node research/corpus-017/performance.mjs <new-output.json> [baseline-index.js]');
 const versions=[['candidate',resolve(root,'dist/index.js')],...(process.argv[3]?[['baseline016',resolve(process.argv[3])]]:[])];
 const rows=[];
 for(let i=0;i<manifest.records.length;i++)for(const[name,module]of versions){
  const r=spawnSync(process.execPath,['--expose-gc','--max-old-space-size=256',fileURLToPath(import.meta.url),'worker',module,String(i),name],{encoding:'utf8',timeout:60000,windowsHide:true});
  assert.equal(r.status,0,r.stderr||String(r.error));
  const row={version:name,...JSON.parse(r.stdout)};rows.push(row);console.log({version:name,id:row.id,medianMs:row.ms.median,peakRssMiB:row.peakRss/1048576,postWarmupHeapDelta:row.postWarmupHeapDelta});
 }
 writeFileSync(process.argv[2],JSON.stringify({node:process.version,platform:process.platform,workerOldSpaceMiB:256,warmups:3,measuredIterations:15,method:'Parse only latency, sequential fresh workers, GC between iterations; memory includes input and result. Not a hard RSS limit or proof of absence of leaks.',rows},null,2)+'\n',{flag:'wx'});
}
