import { readFileSync,writeFileSync,appendFileSync,mkdirSync,readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse,decode,detectFormat } from '../../dist/index.js';
import { realFiles,wptAssertions,wptText } from '../quality-013/corpus.mjs';
import { formatCases } from '../quality-013/format-cases.mjs';
import { loadUpstreamCases } from './oracles.mjs';
const formats=['srt','vtt','sami','ass','ssa'];
const initial={srt:'1\n00:00:01,000 --> 00:00:02,000\n한국어 &amp; العربية\n',vtt:'WEBVTT\n\n00:01.000 --> 00:02.000\n<v A><c.x>日本語</c></v>\n',sami:'<SAMI><BODY><SYNC Start=0><P Class=KO>한글<BR>다음<P Class=EN>English<SYNC Start=1000><P Class=KO>&nbsp;<SYNC Start=2000></BODY></SAMI>',ass:'[Script Info]\nScriptType: v4.00+\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,{\\q2}한글\\n日本語{\\p1}m 0 0 l 2 2{\\p0}end'};
initial.ssa=initial.ass.replace('v4.00+','v4.00').replace('Layer','Marked');
const tokens=['<','>','{','}','\\','\0','\ud800','\udfff','\r','\n','\r\n','\u2028','\u00a0','한국어','العربية','👩🏽‍💻','&amp;','&#x110000;','&notit;','00:00:01.000','9007199254740992','-->','->','<SYNC Start=1>','<P Class=KO>','<!--','-->','<script>','</script>','[Events]','Dialogue:','Format: Text,','{\\p1}','{\\t(0,1,\\p1)}','"',"'",'='.repeat(64),' '.repeat(64)];
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
if(process.argv[2]==='worker') {
  let seed=Number(process.argv[3])>>>0;const seedStart=seed;
  const next=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const pick=n=>Math.floor(next()/4294967296*n);
  const corpus={srt:realFiles().map(f=>f.source),vtt:[...wptAssertions(),...wptText()].map(f=>f.source),sami:[initial.sami],ass:[initial.ass],ssa:[initial.ssa]};
  for (const c of [...formatCases, ...loadUpstreamCases()]) corpus[c.format].push(c.source);
  const stats={cases:0,byFormat:Object.fromEntries(formats.map(f=>[f,0])),statuses:{},maxInput:0,maxParseMs:0,maxHeap:0,maxRss:0,semanticCases:0};
  for(let i=0;i<2048;i++) {
    const format=formats[i%formats.length];let source=corpus[format][pick(corpus[format].length)];
    if(i%9===0)source=initial[format];
    for(let j=0,n=1+pick(8);j<n;j++) {
      const at=pick(source.length+1), token=tokens[pick(tokens.length)];
      switch(pick(6)) {
        case 0:source=source.slice(0,at)+token+source.slice(at);break;
        case 1:source=source.slice(0,at)+source.slice(at+1+pick(100));break;
        case 2:source=source.slice(0,at)+token.repeat(1+pick(i%32===0?2048:8))+source.slice(at);break;
        case 3:source=source.slice(0,at);break;
        case 4:source=source.replaceAll(tokens[pick(tokens.length)],token);break;
        case 5:source=source.slice(0,at)+source.slice(Math.max(0,at-64),at)+source.slice(at);break;
      }
      if(source.length>262144)source=source.slice(0,262144);
    }
    const limits={maxDiagnostics:1+pick(16),maxCues:1+pick(200),maxInputLength:131072,maxLines:10000,maxLineLength:65536};
    try {
      const start=performance.now(), r=parse(source,{format,limits});const elapsed=performance.now()-start;
      stats.maxParseMs=Math.max(stats.maxParseMs,elapsed);stats.maxInput=Math.max(stats.maxInput,source.length);
      stats.cases++;stats.byFormat[format]++;stats.statuses[r.status]=(stats.statuses[r.status]??0)+1;
      if(r.sourceText!==source||r.diagnostics.length>limits.maxDiagnostics||r.cues.length>limits.maxCues)throw Error('source/limit invariant');
      if(r.status==='fatal'&&(r.cues.length||r.tracks.length||r.metadata.length))throw Error('fatal data leak');
      const ids=new Set(r.tracks.map(t=>t.id));if(ids.size!==r.tracks.length)throw Error('duplicate track');
      const lineCount=source.split(/\r\n|\r|\n/).length;
      for(const c of r.cues)if(!Number.isSafeInteger(c.start)||c.start<0||c.end!==null&&(!Number.isSafeInteger(c.end)||c.end<=c.start)||!ids.has(c.trackId)||c.source.line<1||c.source.endLine<c.source.line||c.source.endLine>lineCount)throw Error('cue invariant');
      if(i%16===0){const again=parse(source,{format,limits});if(JSON.stringify(r)!==JSON.stringify(again))throw Error('nondeterminism');detectFormat(source);parse(source,{limits});}
      const b=new Uint8Array(16+pick(128));for(let j=0;j<b.length;j++)b[j]=pick(256);
      const encoding=['utf-8','windows-1252','utf-16le','euc-kr'][i%4];decode(b,{encoding});decode(b,{encoding,fatal:false});
      // Independent arithmetic oracle, not a mutation/output oracle. Exercise all formats.
      if(i%8===0){const s=10*(1+pick(5000)),e=s+10*(1+pick(5000)),t='한국어 العربية 👩🏽‍💻';
        const stamp=n=>`${String(Math.floor(n/3600000)).padStart(2,'0')}:${String(Math.floor(n/60000)%60).padStart(2,'0')}:${String(Math.floor(n/1000)%60).padStart(2,'0')}.${String(n%1000).padStart(3,'0')}`;
        const valid=format==='srt'?`1\n${stamp(s).replace('.',',')} --> ${stamp(e).replace('.',',')}\n${t}`:format==='vtt'?`WEBVTT\n\n${stamp(s)} --> ${stamp(e)}\n${t}`:format==='sami'?`<SAMI><SYNC Start=${s}><P>${t}<SYNC Start=${e}></SAMI>`:`[Events]\nFormat: Start, End, Text\nDialogue: ${stamp(s).slice(0,-1)},${stamp(e).slice(0,-1)},${t}`;
        const newline=['\n','\r','\r\n'][pick(3)];const q=parse(valid.replaceAll('\n',newline),{format});
        if(q.cues.length!==1||q.cues[0].start!==s||q.cues[0].end!==e||q.cues[0].text!==t)throw Error('arithmetic/newline oracle');stats.semanticCases++;
      }
      if(i%64===0){const m=process.memoryUsage();stats.maxHeap=Math.max(stats.maxHeap,m.heapUsed);stats.maxRss=Math.max(stats.maxRss,m.rss);}
    }catch(e){writeFileSync(resolve(process.argv[4],`failure-${seedStart}-${i}.json`),JSON.stringify({seedStart,iteration:i,format,limits,source,error:String(e)},null,2),{flag:'wx'});throw e;}
  }
  console.log(JSON.stringify(stats));
} else {
  const seconds=Number(process.argv[2]??900),output=resolve(process.argv[3]);
  if(!Number.isFinite(seconds)||seconds<1||seconds>86400)throw Error('Duration must be 1..86400 seconds');
  mkdirSync(output);
  const distFiles=[];function walk(path){for(const f of readdirSync(path,{withFileTypes:true})){const p=resolve(path,f.name);if(f.isDirectory())walk(p);else distFiles.push({path:p,sha256:hash(readFileSync(p))});}}
  walk(fileURLToPath(new URL('../../dist',import.meta.url)));walk(fileURLToPath(new URL('../../corpus',import.meta.url)));
  for(const path of ['fuzz.mjs','oracles.mjs','../quality-013/corpus.mjs','../quality-013/format-cases.mjs'].map(p=>fileURLToPath(new URL(p,import.meta.url))))distFiles.push({path,sha256:hash(readFileSync(path))});
  writeFileSync(resolve(output,'inputs.json'),JSON.stringify(distFiles,null,2)+'\n',{flag:'wx'});
  const started=Date.now(), runs=[];let batch=0,failed=false;
  while(Date.now()-started<seconds*1000){const seed=(0x013f0223+Math.imul(batch,0x9e3779b9))>>>0;
    const r=spawnSync(process.execPath,['--max-old-space-size=256',fileURLToPath(import.meta.url),'worker',String(seed),output],{timeout:15000,encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});
    const entry={batch,seed,status:r.status,...(r.status===0?JSON.parse(r.stdout):{error:String(r.error??r.stderr),stdout:r.stdout})};
    runs.push(entry);appendFileSync(resolve(output,'batches.jsonl'),JSON.stringify(entry)+'\n');
    if(r.status!==0){failed=true;break;}batch++;if(batch%20===0)console.log(`${batch} batches, ${Math.round((Date.now()-started)/1000)} seconds`);
  }
  const changed=distFiles.filter(f=>hash(readFileSync(f.path))!==f.sha256);
  writeFileSync(resolve(output,'result.json'),JSON.stringify({startedAt:new Date(started).toISOString(),durationSeconds:(Date.now()-started)/1000,budgetSeconds:seconds,node:process.version,platform:process.platform,workerHeapLimitMiB:256,batchTimeoutMs:15000,seedAlgorithm:'0x013f0223 + batch * 0x9e3779b9 modulo 2^32',batches:runs.length,mutationCases:runs.reduce((s,r)=>s+(r.cases??0),0),semanticCases:runs.reduce((s,r)=>s+(r.semanticCases??0),0),failed,distUnchanged:changed.length===0,distFiles,runs},null,2)+'\n');
  if(failed||changed.length)process.exitCode=1;
}
