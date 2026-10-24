// Restricted source transcription, deliberately independent of all parsers under test.
// Run BEFORE compare.mjs. Refuse unfamiliar grammar instead of copying parser output.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const manifest=JSON.parse(readFileSync(new URL('./local-manifest.json',import.meta.url)));
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
function clock(s) {
  const m=/^(\d+):(\d{1,2}):(\d{1,2})\.(\d{2})$/.exec(s.trim());
  if(!m)return null;
  const [h,mn,sc,cs]=m.slice(1).map(Number);
  assert.ok(mn<60&&sc<60,'Noncanonical range requires separate review');
  return h*3600000+mn*60000+sc*1000+cs*10;
}
for(const record of manifest.records) {
  const bytes=readFileSync(new URL(record.path,root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);
  const source=new TextDecoder(record.encoding,{fatal:true}).decode(bytes);
  const cues=[],rejected=[];
  let textScored=true;
  if(['ffmpeg/Intro_to_Message_Routing.smi','ffmpeg/Intro_to_SMTP_messaging.smi','ffmpeg/SAMI_Demo.smi'].includes(record.id)){
    // These authoring-tool commands are malformed HTML, e.g. <SpanID="...">
    // and <ShowImg=...>. A tag-stripping oracle would silently discard them.
    // Preserve observations, but do not invent authoritative layout/cue semantics.
    records.push({id:record.id,unscoredReason:'Legacy SpanID/ShowImg commands require a player-specific oracle; generic tag stripping is invalid.'});continue;
  }
  if(record.id==='ffmpeg/sami-div.smi'){
    assert.deepEqual([...source.matchAll(/<sync\s+start="(\d+)"/gi)].map(m=>Number(m[1])),[2000,4000,6000,8000,10000,12000]);
    records.push({id:record.id,textScored:false,rejected:[],cues:[
      {start:2000,end:4000,cls:'ENUSCC'}, {start:4000,end:6000,cls:'ENUSCC'},
      {start:6000,end:8000,cls:'ENUSCC'}, {start:8000,end:12000,cls:'ENUSCC'},
      {start:10000,end:12000,cls:''}
    ],basis:'Literal six SYNC times; last two lack P. Recovery uses a default track at 10000; the empty 12000 SYNC closes all active tracks. Layout text not scored.'});continue;
  }
  if(record.format!=='sami') {
    let names;
    for(const line of source.split(/\r\n|\r|\n/)) {
      if(/^Format:/i.test(line)) names=line.slice(line.indexOf(':')+1).split(',').map(s=>s.trim().toLowerCase());
      if(!/^Dialogue:/i.test(line))continue;
      assert.equal(names.at(-1),'text');
      const columns=line.slice(line.indexOf(':')+1).trimStart().split(',');
      const raw=columns.slice(names.length-1).join(',');
      const start=clock(columns[names.indexOf('start')]),end=clock(columns[names.indexOf('end')]);
      if(start===null||end===null||end<=start){rejected.push(line);continue;}
      // Only pos/i overrides and default WrapStyle=0 exist in these local ASS samples.
      for(const block of raw.match(/\{[^{}]*\}/g)??[])assert.match(block,/^\{(?:\\pos\(\d+,\d+\)|\\i[01])\}$/,'Unscored override state');
      assert.ok(!/WrapStyle:\s*[1-3]/i.test(source),'Nondefault wrap needs another oracle');
      const text=raw.replace(/\{[^{}]*\}/g,'').replaceAll('\\N','\n').replaceAll('\\n',' ');
      cues.push({start,end,text,raw});
    }
  }else{
    const body=source.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1]?.replace(/<!--[\s\S]*?-->/g,'');
    assert.ok(body!==undefined,'Requires explicit BODY boundaries');
    // Layout semantics for DIV, H3 and TABLE are intentionally not text-scored.
    textScored=!/<(?:div|h3|table)\b/i.test(body);
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
  }
  // Literal anchors were transcribed from source, not from candidate/comparator output.
  if(record.id==='pbs/example.sami')assert.deepEqual([cues[0].start,cues[0].end,cues[0].text],[9209,12312,'( clock ticking )']);
  if(record.id==='ffmpeg/SAMI 01 hour.smi')assert.deepEqual([cues[0].start,cues.at(-1).end],[3602231,3627831]);
  if(record.id==='astisub/example-in-carriage-return.ssa')assert.equal(cues.length,0);
  if(record.id.startsWith('gaupol/'))assert.equal(rejected.length,2);
  records.push({id:record.id,textScored,cues,rejected});
}
writeFileSync(process.argv[2],JSON.stringify({basis:'Independent restricted source transcription plus literal anchors; negative/ambiguous precision timestamps are rejected by declared API policy.',records},null,2)+'\n',{flag:'wx'});
console.log(records.map(r=>({id:r.id,cues:r.cues?.length,rejected:r.rejected?.length,textScored:r.textScored,unscoredReason:r.unscoredReason})));
