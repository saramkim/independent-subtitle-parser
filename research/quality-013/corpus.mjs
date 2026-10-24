import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
export const root = new URL('../../corpus/', import.meta.url);
export const manifest = JSON.parse(readFileSync(new URL('manifest.json', root)));
export function verifyCorpus() {
  for(const r of manifest.records) {
    const b=readFileSync(new URL(r.path,root));
    if(b.length!==r.bytes || createHash('sha256').update(b).digest('hex')!==r.sha256) throw Error(`Corpus changed: ${r.path}`);
  }
}
// Restricted decoding of WPT's literal fixture notation; never execute downloaded code.
export function unescape(s) { return s.replace(/\\(?:u([\da-fA-F]{4})|x([\da-fA-F]{2})|([nrtbf\\"']))/g,(_,u,x,c)=>u||x?String.fromCharCode(parseInt(u||x,16)):({n:'\n',r:'\r',t:'\t',b:'\b',f:'\f'}[c]??c)); }
export function wptAssertions() {
  const cases=[];
  for(const r of manifest.records.filter(r=>r.path.includes('/file-parsing/support/')&&r.path.endsWith('.test'))) {
    const data=readFileSync(new URL(r.path,root),'utf8'), code=data.split('\n===\n')[0];
    const assertions=[];
    for(const m of code.matchAll(/assert_equals\(cues(?:\[(\d+)\]\.(text|startTime|endTime|id)|\.(length)),\s*('(?:\\.|[^'\\])*'|[\d.]+)\s*\)/g)) {
      assertions.push({index:m[1]===undefined?null:Number(m[1]),property:m[2]??m[3],expected:m[4][0]==="'"?unescape(m[4].slice(1,-1)):Number(m[4])});
    }
    const inputPath=r.path.replace('/file-parsing/support/','/file-parsing/tests/support/').replace(/\.test$/,'.vtt');
    const source=readFileSync(new URL(inputPath,root),'utf8');
    cases.push({id:r.path.split('/').at(-1),format:'vtt',source,assertions,
      coverage:'Literal count/id/text/time assertions only; dynamic loops/layout are not evaluated',sourcePath:inputPath});
  }
  return cases;
}
export function wptText() {
  const cases=[];
  for(const r of manifest.records.filter(r=>r.path.endsWith('.dat'))) {
    const data=readFileSync(new URL(r.path,root),'utf8');let index=0;
    for(const block of data.split('#data\n').slice(1)) {
      const raw=block.split('\n#errors')[0], tree=block.split('#document-fragment\n')[1]??'';
      const expected=[...tree.matchAll(/^\| +"(.*)"$/gm)].map(m=>unescape(m[1])).join('');
      cases.push({id:`${r.path.split('/').at(-1)}:${index++}`,format:'vtt',source:`WEBVTT\n\n00:00.000 --> 00:10.000\n${unescape(raw)}\n`,expected,sourcePath:r.path});
    }
  }
  return cases;
}
export function realFiles() {
  return manifest.records.filter(r=>r.kind==='real-file').map(r=>{
    const bytes=readFileSync(new URL(r.path,root));
    // BOM is an independent byte-level declaration. No charset guessing.
    const encoding=bytes[0]===255&&bytes[1]===254?'utf-16le':bytes[0]===254&&bytes[1]===255?'utf-16be':'utf-8';
    return {id:r.path,format:'srt',encoding,bytes,source:new TextDecoder(encoding,{fatal:true}).decode(bytes)};
  });
}
// A deliberately narrow independent oracle: every SRT block must have an index,
// exactly two fixed-width comma clocks, and a nonempty payload. Reject anything
// else so it must be inspected; no recovery rules or production helpers reused.
export function strictSrtOracle(source) {
  const blocks=source.replace(/^\ufeff/,'').replace(/\r\n?/g,'\n').trimEnd().split(/\n\n+/);
  const clock=s=>{const [h,m,sec,ms]=s.split(/[:,]/).map(Number);if(m>59||sec>59)throw Error('clock range');return h*3600000+m*60000+sec*1000+ms;};
  return blocks.map(b=>{
    const lines=b.split('\n');
    if(!/^\d+$/.test(lines[0]) || !/^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$/.test(lines[1]) || lines.length<3)throw Error(`noncanonical block ${lines[0]}`);
    const [s,e]=lines[1].split(' --> ');return [clock(s),clock(e),lines.slice(2).join('\n')];
  });
}
