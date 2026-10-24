// Source-derived restricted oracle: no candidate or reference-parser imports.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('./local-manifest.json',import.meta.url)));
const records=[];
const clock=s=>{
 const m=/^(\d+):(\d{1,2}):(\d{1,2})\.(\d{2})$/.exec(s.trim());
 if(!m)return null;
 const [h,min,sec,cs]=m.slice(1).map(BigInt);
 if(min>=60n||sec>=60n)return null;
 const value=h*3600000n+min*60000n+sec*1000n+cs*10n;
 return value>BigInt(Number.MAX_SAFE_INTEGER)?null:Number(value);
};
for(const record of manifest.records){
 const bytes=readFileSync(new URL(record.path,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);
 const source=new TextDecoder(record.encoding,{fatal:true}).decode(bytes);
 const rows=[],rejected=[],comments=[];let columns=null,inEvents=false;
 const wrap=Number(source.match(/^WrapStyle:\s*([0-3])/m)?.[1]??0);
 for(const [index,line]of source.split(/\r\n|\r|\n/).entries()){
  if(/^\[/.test(line.trim()))inEvents=line.trim().toLowerCase()==='[events]';
  if(!inEvents)continue;
  if(/^Format:/i.test(line)){columns=line.slice(line.indexOf(':')+1).split(',').map(s=>s.trim());continue;}
  if(!/^(Dialogue|Comment):/i.test(line))continue;
  assert.ok(columns);assert.equal(columns.at(-1).toLowerCase(),'text');
  const parts=line.slice(line.indexOf(':')+1).replace(/^[ \t]/,'').split(',');
  assert.ok(parts.length>=columns.length);
  const fields=columns.map((name,i)=>({name,value:i===columns.length-1?parts.slice(i).join(','):parts[i]}));
  if(/^Comment:/i.test(line)){comments.push(line);continue;}
  const get=name=>fields.find(f=>f.name.toLowerCase()===name).value;
  const start=clock(get('start')),end=clock(get('end')),raw=get('text');
  if(start===null||end===null||end<=start){rejected.push(line);continue;}
  // Score reading text only where stateful drawing/wrapping/reset and malformed
  // braces are absent. Rendering correctness is never inferred from raw equality.
  const outside=raw.replace(/\{[^{}]*\}/g,'');
  const simple=!/\\(?:[pqr]|[{}])/.test(raw)&&!/[{}]/.test(outside)&&!/^Banner;/i.test(get('effect'));
  const text=simple?outside.replaceAll('\\N','\n').replaceAll('\\n',wrap===2?'\n':' ').replaceAll('\\h','\u00a0'):null;
  rows.push({start,end,raw,fields,line:index+1,text});
 }
 assert.ok(rows.length||rejected.length);
 records.push({id:record.id,rows,rejected,comments,sourceSha256:record.sha256,wrap});
 console.log({id:record.id,accepted:rows.length,rejected:rejected.length,comments:comments.length,readingScored:rows.filter(r=>r.text!==null).length,first:rows[0]?.start,lastEnd:rows.at(-1)?.end});
}
writeFileSync(process.argv[2],JSON.stringify({basis:'Canonical event columns transcribed from original files; BigInt centisecond arithmetic; stateful rendering cases excluded from text score.',records})+'\n',{flag:'wx'});
