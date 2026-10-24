import {writeFileSync} from 'node:fs';
import {parse} from '../../dist/index.js';
import subsrt from 'subsrt';
import {parse as parseAss} from 'ass-compiler';
import {formatCases} from './format-cases.mjs';
const rows=formatCases.map(f=>{
  const own=parse(f.source,{format:f.format});
  const observations=[{parser:'candidate',dimension:'reading-text',actual:own.cues.map(c=>[c.start,c.end,c.text]),expected:f.expected,trackClasses:own.cues.map(c=>own.tracks.find(t=>t.id===c.trackId)?.sourceClass??null)}];
  try{const r=subsrt.parse(f.source,{format:f.format==='sami'?'smi':f.format,eol:'\n'});observations.push({parser:'subsrt@1.1.1',dimension:'reading-text',expected:f.expected,actual:r.filter(c=>c.type==='caption').map(c=>[c.start,c.end,c.text])});}catch(e){observations.push({parser:'subsrt@1.1.1',error:String(e)});}
  if(f.format!=='sami')try{const r=parseAss(f.source);observations.push({parser:'ass-compiler@0.1.16',dimension:'time/raw-text',expected:f.rawExpected,actual:r.events.dialogue.map(c=>[Math.round(c.Start*1000),Math.round(c.End*1000),c.Text.raw])});}catch(e){observations.push({parser:'ass-compiler@0.1.16',error:String(e)});}
  for(const o of observations)if(!o.error)o.matchesExpected=JSON.stringify(o.actual)===JSON.stringify(o.expected);
  return {id:f.id,basis:f.basis,observations};
});
writeFileSync(process.argv[2],JSON.stringify({node:process.version,rows,note:'Raw ASS syntax and reading projections are separate dimensions. ass-compiler has a richer tag/drawing representation not measured by these reading tests; subsrt has serializers not measured here.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(rows.flatMap(r=>r.observations.filter(o=>o.error||!o.matchesExpected).map(o=>({id:r.id,...o}))),null,2));
if(rows.some(r=>!r.observations[0].matchesExpected))process.exitCode=1;
