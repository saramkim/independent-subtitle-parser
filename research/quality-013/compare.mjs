import { readFileSync,writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { verifyCorpus,wptAssertions,wptText,realFiles,strictSrtOracle } from './corpus.mjs';
import {checkedWptCases,realOracle,preservedWptTextDifferences} from './oracles.mjs';
const {parse} = await import(process.env.PARSER_ENTRY ? pathToFileURL(process.env.PARSER_ENTRY).href : '../../dist/index.js');
const requireRef = createRequire(new URL('../reference-parsers/package.json',import.meta.url));
const {parseSync}=requireRef('subtitle'), plus=requireRef('@plussub/srt-vtt-parser'),vtt=requireRef('webvtt-parser');
const media=await import(pathToFileURL(requireRef.resolve('media-captions')).href);
const parsers=[
  {name:'candidate',run:(s,f)=>parse(s,{format:f}).cues.map(c=>({startTime:c.start/1000,endTime:c.end/1000,text:c.rawText,id:c.id??''}))},
  {name:'subtitle@4.2.2',run:s=>parseSync(s).filter(c=>c.type==='cue').map(({data:c})=>({startTime:c.start/1000,endTime:c.end/1000,text:c.text,id:String(c.index??'')}))},
  {name:'@plussub/srt-vtt-parser@2.0.5',run:s=>plus.parse(s).entries.map(c=>({startTime:c.from/1000,endTime:c.to/1000,text:c.text,id:c.id??''}))},
  {name:'media-captions@0.0.18',run:async(s,f)=>(await media.parseText(s,{type:f,errors:true})).cues},
  {name:'webvtt-parser@2.2.0',vtt:true,run:s=>new vtt.WebVTTParser().parse(s).cues}
];
verifyCorpus();
const rows=[];
for(const fixture of checkedWptCases()) {
  const observations=[];
  for(const p of parsers) {
    try {const cues=await p.run(fixture.source,'vtt');
      const failures=fixture.assertions.flatMap(a=>{
        const actual=a.index===null?cues.length:cues[a.index]?.[a.property];
        return Object.is(actual,a.expected)?[]:[{...a,actual:actual??null}];
      });observations.push({parser:p.name,count:cues.length,checked:fixture.assertions.length,failures});
    }catch(e){observations.push({parser:p.name,error:String(e)});}
  }
  rows.push({id:fixture.id,kind:'wpt-literal-assertions',observations});
}
for(const fixture of realFiles()) {
  const {expected:oracle,basis}=realOracle(fixture);
  const observations=[];
  for(const p of parsers.filter(p=>!p.vtt)) {
    try {const cues=await p.run(fixture.source,'srt');const raw=cues.map(c=>[Math.round(c.startTime*1000),Math.round(c.endTime*1000),c.text]);
      const failures=[];if(oracle)for(let i=0;i<Math.max(raw.length,oracle.length);i++)if(JSON.stringify(raw[i])!==JSON.stringify(oracle[i]))failures.push({index:i,expected:oracle[i],actual:raw[i]});
      observations.push({parser:p.name,count:raw.length,nonemptyPayloads:raw.filter(c=>c[2]?.length).length,scored:oracle!==null,failures});
    }catch(e){observations.push({parser:p.name,error:String(e)});}
  }
  rows.push({id:fixture.id,kind:'real-file',encoding:fixture.encoding,expectedCount:oracle?.length??null,basis,observations});
}
const projections=wptText().map(f=>{const actual=parse(f.source,{format:'vtt'}).cues[0]?.text??'';
  const r=new vtt.WebVTTParser().parse(f.source);const flat=n=>n.type==='text'?n.value:(n.children??[]).map(flat).join('');
  const upstream=r.cues[0]?flat(r.cues[0].tree):'';
  return {id:f.id,source:f.source,expected:f.expected,actual,upstream,pass:actual===f.expected,upstreamPass:upstream===f.expected,adjudication:preservedWptTextDifferences.get(f.id)??null};});
const result={at:new Date().toISOString(),node:process.version,rows,projections};
writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:rows.length,ownFailures:rows.filter(r=>r.oracleReviewRequired||r.observations?.some(o=>o.parser==='candidate'&&(o.error||o.failures.length))).map(r=>({id:r.id,review:r.oracleReviewRequired,observation:r.observations?.[0]})),projectionFailures:projections.filter(p=>!p.pass)},null,2));
