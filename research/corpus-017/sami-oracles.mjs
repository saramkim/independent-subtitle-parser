// Restricted source transcription, deliberately independent of all parsers under test.
// Run BEFORE compare.mjs. Refuse unfamiliar grammar instead of copying parser output.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const manifest=JSON.parse(readFileSync(new URL('../corpus-016/local-manifest.json',import.meta.url)));
manifest.records=manifest.records.filter(r=>['ffmpeg/Intro_to_Message_Routing.smi','ffmpeg/Intro_to_SMTP_messaging.smi','ffmpeg/SAMI_Demo.smi'].includes(r.id));
const root=new URL('../../',import.meta.url);
const records=[];
const entities={nbsp:'\u00a0',quot:'"',amp:'&',lt:'<',gt:'>'};
function entity(s) { return s.replace(/&nbsp(?![a-z0-9;])/gi,'\u00a0').replace(/&([^;\s]+);/g,(_,v)=> {
  if(/^#\d+$/.test(v))return String.fromCodePoint(Number(v.slice(1)));
  assert.ok(Object.hasOwn(entities,v),`Unknown entity ${v}`);return entities[v];
}); }
function attr(s,name) {
  const m=new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,'i').exec(s);
  return m ? m[1]??m[2]??m[3] : '';
}
for(const record of manifest.records) {
  const bytes=readFileSync(new URL(record.path,root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);
  const source=new TextDecoder(record.encoding,{fatal:true}).decode(bytes);
  const cues=[];
  const body=source.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1]?.replace(/<!--[\s\S]*?-->/g,'');
  assert.ok(body!==undefined,'Requires explicit BODY boundaries');
  // Layout semantics for DIV, H3 and TABLE are intentionally not text-scored.
  // Routing samples use TABLE only as an outer wrapper; their paragraph text
  // has no layout tags. Demo's H3 display remains excluded from text scoring.
  const textScored=record.id!=='ffmpeg/SAMI_Demo.smi';
  const syncs=[...body.matchAll(/<sync\b([^>]*)>([\s\S]*?)(?=<sync\b|$)/gi)];
  const active=new Map();let prior=-1;
  for(const sync of syncs){
    const rawStart=attr(sync[1],'start');assert.match(rawStart,/^\d+$/);
    const start=Number(rawStart);assert.ok(start>=prior&&(start>prior||active.size===0),'Nonincreasing active SYNC requires separate review');prior=start;
    const paragraphs=[...sync[2].matchAll(/<p\b([^>]*)>([\s\S]*?)(?=<p\b|$)/gi)];
    if(!paragraphs.length){
      assert.equal(sync[2].replace(/<[^>]*>/g,'').trim(),'',`Unassigned text: ${record.id}`);
      for(const cue of active.values())cue.end=start;
      active.clear();continue;
    }
    const groups=new Map();
    for(const p of paragraphs){
      const cls=attr(p[1],'class');
      // Physical lines collapse; only authored BR introduces a reading break.
      const brParts=p[2].split(/<br\s*\/?\s*>/i).map(s=>entity(s.replace(/<[^>]*>/g,'').replace(/[\t\r\n ]+/g,' ').trim()));
      const text=brParts.join('\n');
      if(!groups.has(cls))groups.set(cls,[]);groups.get(cls).push(text);
    }
    for(const [cls,texts] of groups){
      if(active.has(cls))active.get(cls).end=start;
      const text=texts.join('\n');
      if(/^[\s\u00a0]*$/.test(text)){active.delete(cls);continue;}
      const cue={start,end:null,text,cls};cues.push(cue);active.set(cls,cue);
    }
  }
  const commands=source.match(/<(?:spanid|showimg|displayimg)[:=][^<>]*>/gi)??[];
  records.push({id:record.id,textScored,cues,commands});
}
writeFileSync(process.argv[2],JSON.stringify({basis:'Restricted SAMI source transcription; legacy commands are nonspoken authoring data; demo layout text is not scored.',records},null,2)+'\n',{flag:'wx'});
console.log(records.map(r=>({id:r.id,cues:r.cues?.length,textScored:r.textScored})));
