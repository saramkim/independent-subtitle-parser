import { spawnSync } from 'node:child_process';
import { readFileSync,writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import os from 'node:os';
import { workload,verify } from './workloads.mjs';
const requireRef=createRequire(new URL('../reference-parsers/package.json',import.meta.url));
async function adapter(name) {
  if(name==='candidate'||name==='baseline-0.1.2') {
    const {parse}=await import(name==='candidate'?'../../dist/index.js':'./baseline-dist/index.js');
    return {run:(s,f)=>parse(s,{format:f}),normalize:r=>{if(r.status==='fatal')throw Error('fatal');return r.cues;}};
  }
  if(name==='subtitle@4.2.2'){const {parseSync}=requireRef('subtitle');return{run:s=>parseSync(s),normalize:r=>r.filter(c=>c.type==='cue').map(({data:c})=>({start:c.start,end:c.end,text:c.text}))};}
  if(name==='plus@2.0.5'){const {parse}=requireRef('@plussub/srt-vtt-parser');return{run:parse,normalize:r=>r.entries.map(c=>({start:c.from,end:c.to,text:c.text}))};}
  if(name==='webvtt@2.2.0'){const {WebVTTParser}=requireRef('webvtt-parser');return{run:s=>new WebVTTParser().parse(s),normalize:r=>r.cues.map(c=>({start:Math.round(c.startTime*1000),end:Math.round(c.endTime*1000),text:c.text}))};}
  if(name==='media@0.0.18'){const {parseText}=await import(pathToFileURL(requireRef.resolve('media-captions')).href);return{run:(s,f)=>parseText(s,{type:f}),normalize:r=>r.cues.map(c=>({start:Math.round(c.startTime*1000),end:Math.round(c.endTime*1000),text:c.text}))};}
  if(name==='subsrt@1.1.1'){const {default:subsrt}=await import('subsrt');return{run:(s,f)=>subsrt.parse(s,{format:f==='sami'?'smi':f,eol:'\n'}),normalize:r=>r.filter(c=>c.type==='caption').map(c=>({start:c.start,end:c.end,text:c.text}))};}
  if(name==='ass-compiler@0.1.16'){const {parse}=await import('ass-compiler');return{run:parse,normalize:r=>r.events.dialogue.map(c=>({start:Math.round(c.Start*1000),end:Math.round(c.End*1000),text:c.Text.combined}))};}
  throw Error(name);
}
if(process.argv[2]==='worker') {
  const [name,format,n,style]=process.argv.slice(3);const count=Number(n),rich=style==='rich';
  const a=await adapter(name),source=workload(format,count,rich),samples=[],retained=[],released=[];
  global.gc();const baseline=process.memoryUsage();
  try {
    for(let i=0;i<9;i++) {
      global.gc();const before=process.memoryUsage().heapUsed,start=performance.now();let r=await a.run(source,format);const ms=performance.now()-start;
      verify(a.normalize(r),format,count,rich);
      if(i>=2)samples.push(ms);
      global.gc();retained.push(process.memoryUsage().heapUsed-before);r=null;
      // Release fulfilled await temporaries before measuring retained memory.
      await new Promise(setImmediate);global.gc();released.push(process.memoryUsage().heapUsed);
    }
    console.log(JSON.stringify({name,format,count,rich,inputUnits:source.length,correct:true,samplesMs:samples,medianMs:[...samples].sort((a,b)=>a-b)[3],baseline,processPeakRssKiB:process.resourceUsage().maxRSS,retainedHeapDeltaBytes:retained,postReleaseHeapBytes:released}));
  }catch(e){console.log(JSON.stringify({name,format,count,rich,correct:false,error:String(e),throughputDisqualified:true}));}
} else if(process.argv[2]==='stress') {
  const {parse}=await import('../../dist/index.js');
  const cases=[
    ['oversize-input','srt','x'.repeat(8*1024*1024+1),'INPUT_LIMIT'],
    ['newline-flood','srt','\n'.repeat(250001),'LINE_LIMIT'],
    ['long-line','srt','x'.repeat(1048577),'LINE_LENGTH_LIMIT'],
    ['empty-syncs','sami','<SAMI>\n'+Array.from({length:100000},(_,i)=>`<SYNC Start=${i}>`).join('\n')+'\n</SAMI>',null],
    ['many-tracks','sami','<SAMI><SYNC Start=0>'+Array.from({length:50000},(_,i)=>`<P Class=c${i}>x`).join('')+'<SYNC Start=1></SAMI>',null],
    ['warning-storm','vtt','WEBVTT\n\n'+Array.from({length:50000},(_,i)=>`00:00.000 --> 00:01.000\n<unknown${i}>x\n\n`).join(''),null],
    ['unterminated-tags','vtt','WEBVTT\n\n00:00.000 --> 00:01.000\n'+'<v '.repeat(200000),null]
  ];
  const rows=[];
  for(const [id,format,source,fatal]of cases){global.gc();const before=process.memoryUsage(),t=performance.now();let r=parse(source,{format});const ms=performance.now()-t;
    if(fatal&&(!r.diagnostics.some(d=>d.code===fatal)||r.status!=='fatal'))throw Error(id);
    if(!fatal&&r.status==='fatal')throw Error(id+' unexpected fatal');
    global.gc();const holding=process.memoryUsage();rows.push({id,ms,units:source.length,status:r.status,cues:r.cues.length,tracks:r.tracks.length,metadata:r.metadata.length,diagnostics:r.diagnostics.length,diagnosticsTruncated:r.diagnosticsTruncated,before,holding,processPeakRssKiB:process.resourceUsage().maxRSS});r=null;global.gc();}
  // Same live input, repeated results released, explicit GC: drift is not a proof
  // of leaks, but a useful bounded retention check after JIT warmup.
  const s=workload('sami',10000,true),heap=[];
  function parseAndRelease(){const r=parse(s,{format:'sami'});verify(r.cues,'sami',10000,true);return r.cues.length;}
  for(let i=0;i<80;i++){parseAndRelease();await new Promise(setImmediate);global.gc();heap.push(process.memoryUsage().heapUsed);}
  console.log(JSON.stringify({rows,repeated:{iterations:80,postReleaseHeapBytes:heap,tailSpreadBytes:Math.max(...heap.slice(20))-Math.min(...heap.slice(20))}},null,2));
} else {
  const output=process.argv[2],rows=[];const started=new Date().toISOString();
  for(const count of [1000,10000,50000])for(const format of ['srt','vtt','ass','sami']) {
    const names=['candidate','baseline-0.1.2','subsrt@1.1.1',...(format==='srt'||format==='vtt'?['subtitle@4.2.2','plus@2.0.5','media@0.0.18']:[]),...(format==='vtt'?['webvtt@2.2.0']:[]),...(format==='ass'?['media@0.0.18','ass-compiler@0.1.16']:[])];
    // Rotate candidate/baseline position between sizes to reduce fixed-order bias.
    if(count===10000)names.reverse();
    for(const style of ['plain','rich'])for(const name of names.filter(n=>style==='plain'||n==='candidate'||n==='baseline-0.1.2')) {
      const r=spawnSync(process.execPath,['--expose-gc','--max-old-space-size=768',fileURLToPath(import.meta.url),'worker',name,format,String(count),style],{timeout:60000,encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});
      const row=r.status===0?JSON.parse(r.stdout):{name,format,count,style,correct:false,error:String(r.error??r.stderr),throughputDisqualified:true};rows.push(row);console.log(`${name} ${format} ${count} ${style}: ${row.correct?row.medianMs.toFixed(2)+' ms':'DISQUALIFIED'}`);
    }
  }
  writeFileSync(output,JSON.stringify({started,finished:new Date().toISOString(),node:process.version,platform:process.platform,cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalMemory:os.totalmem(),method:'Isolated child for each cell; 2 warmups + 7 samples; GC outside timed parse; every cue checked. Peak RSS is whole child including input/imports/validation, not parser-only allocation. Rich only compared to own 0.1.2.',rows},null,2)+'\n',{flag:'wx'});
}
