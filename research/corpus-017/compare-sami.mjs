import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parse,decode} from '../../dist/index.js';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const baseline=process.argv[4]?(await import(pathToFileURL(resolve(process.argv[4])))).parse:null;
const manifest=JSON.parse(readFileSync(new URL('../corpus-016/local-manifest.json',import.meta.url)));
const expected=JSON.parse(readFileSync(process.argv[2]));
const rows=[];
for(const e of expected.records){
 const file=manifest.records.find(f=>f.id===e.id);
 const bytes=readFileSync(new URL('../../'+file.path,import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);
 const source=decode(bytes,{encoding:file.encoding}).text;
 const result=parse(source,{format:'sami'});
 const project=(c,r)=>[c.start,c.end,r.tracks.find(t=>t.id===c.trackId).sourceClass,...(e.textScored?[c.text]:[])];
 const want=e.cues.map(c=>[c.start,c.end,c.cls,...(e.textScored?[c.text]:[])]);
 const actual=result.cues.map(c=>project(c,result));
 assert.deepEqual(actual,want,e.id);
 assert.equal(result.sourceText,source);
 assert.deepEqual(result.metadata.filter(m=>m.kind==='sami-legacy-command').map(m=>m.raw),e.commands);
 assert.equal(result.diagnostics.filter(d=>d.code==='SAMI_LEGACY_COMMAND_UNAPPLIED').length,1);
 const old=baseline?.(source,{format:'sami'});
 rows.push({id:e.id,cues:result.cues.length,textScored:e.textScored,commands:e.commands.length,match:true,baseline016:old?{cues:old.cues.length,matches:JSON.stringify(old.cues.map(c=>project(c,old)))===JSON.stringify(want)}:null,diagnostics:[...new Set(result.diagnostics.map(d=>d.code))]});
}
writeFileSync(process.argv[3],JSON.stringify({node:process.version,rows},null,2)+'\n',{flag:'wx'});
console.log(rows);
