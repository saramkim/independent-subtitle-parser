import assert from 'node:assert/strict';
import { readFileSync,writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { workload,verify } from '../quality-013/workloads.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
if(process.argv[2]==='worker'){
  const [entry,id,oraclePath]=process.argv.slice(3);
  const {parse}=await import(pathToFileURL(resolve(entry)));
  let source,format,check;
  if(id==='pbs'){
    source=readFileSync(resolve(root,'.reference-cache/corpus-016/pbs/example.sami'),'utf8');format='sami';
    const expected=JSON.parse(readFileSync(oraclePath)).records.find(r=>r.id==='pbs/example.sami').cues.map(c=>[c.start,c.end,c.text]);
    check=r=>assert.deepEqual(r.cues.map(c=>[c.start,c.end,c.text]),expected);
  }else{
    const [f,n,style]=id.split(':');format=f;const count=Number(n),rich=style==='rich';
    source=workload(format,count,rich);check=r=>verify(r.cues,format,count,rich);
  }
  const samples=[],retained=[],released=[];
  for(let i=0;i<9;i++){
    global.gc();const before=process.memoryUsage().heapUsed,start=performance.now();
    let result=parse(source,{format});const ms=performance.now()-start;
    assert.notEqual(result.status,'fatal');check(result);
    if(i>=2)samples.push(ms);
    global.gc();retained.push(process.memoryUsage().heapUsed-before);result=null;
    await new Promise(setImmediate);global.gc();released.push(process.memoryUsage().heapUsed);
  }
  console.log(JSON.stringify({id,inputUnits:source.length,sourceSha256:createHash('sha256').update(source).digest('hex'),correct:true,samplesMs:samples,medianMs:[...samples].sort((a,b)=>a-b)[3],retainedHeapBytes:retained,postReleaseHeapBytes:released,processPeakRssKiB:process.resourceUsage().maxRSS}));
}else{
  const [baseline,oraclePath,output]=process.argv.slice(2);
  assert.ok(output,'Usage: performance.mjs <baseline-dist/index.js> <local-oracle.json> <new-output.json>');
  const cases=['pbs',...['ass','sami'].flatMap(f=>[10000,50000].flatMap(n=>['plain','rich'].map(s=>`${f}:${n}:${s}`)))];
  const rows=[];
  for(const [i,id]of cases.entries())for(const name of i%2?['candidate','baseline']:['baseline','candidate']){
    const entry=name==='candidate'?resolve(root,'dist/index.js'):resolve(baseline);
    const r=spawnSync(process.execPath,['--expose-gc','--max-old-space-size=768',fileURLToPath(import.meta.url),'worker',entry,id,oraclePath],{encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:4*1024*1024});
    rows.push({name,...(r.status===0?JSON.parse(r.stdout):{id,correct:false,error:String(r.error??r.stderr)})});
    console.log(`${name} ${id}: ${r.status===0?'PASS':'FAIL'}`);
  }
  writeFileSync(output,JSON.stringify({node:process.version,platform:process.platform,baseline:resolve(baseline),note:'Isolated workers; alternating order; two warmups and seven measured samples. Process RSS includes runtime and input. No universal speed/memory claim.',rows},null,2)+'\n',{flag:'wx'});
  if(rows.some(r=>!r.correct))process.exitCode=1;
}
