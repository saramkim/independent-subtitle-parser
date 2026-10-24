import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { parse, decode } from '../dist/index.js';

// Arithmetic generators are independent of parser helpers. Exact expected times
// are drawn first; text is then serialized using public format units.
function random(seed) { return () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed; }; }
const stamp = ms => {
  const hours=Math.floor(ms/3600000),minutes=Math.floor(ms/60000)%60,seconds=Math.floor(ms/1000)%60;
  return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;
};
for(const format of ['srt','vtt','ass','ssa','sami']) {
  test(`${format}: 256 generated multilingual intervals retain independent arithmetic and exact source`,()=>{
    const next=random(0x63756573);const expected=[];let cursor=0;
    for(let i=0;i<256;i++) {
      cursor+=10*(1+next()%500000);
      const duration=10*(1+next()%10000);
      expected.push([cursor,cursor+duration,`한국어 العربية 日本語 👩🏽‍💻 e\u0301 ${i}`]);cursor+=duration;
    }
    let input;
    if(format==='srt'||format==='vtt') input=(format==='vtt'?'WEBVTT\n\n':'')+expected.map(([s,e,t],i)=>`${i+1}\n${format==='srt'?stamp(s).replace('.',','):stamp(s)} --> ${format==='srt'?stamp(e).replace('.',','):stamp(e)}\n${t}`).join('\n\n');
    else if(format==='ass'||format==='ssa') input=`[Script Info]\nScriptType: v4.00${format==='ass'?'+':''}\n[Events]\nFormat: ${format==='ass'?'Layer':'Marked'}, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`+expected.map(([s,e,t])=>`Dialogue: ${format==='ass'?'0':'Marked=0'},${stamp(s).slice(0,-1)},${stamp(e).slice(0,-1)},Default,,0,0,0,,${t}`).join('\n');
    else input='<SAMI>\n'+expected.map(([s,e,t])=>`<SYNC Start=${s}><P Class=KO>${t}\n<SYNC Start=${e}><P Class=KO>&nbsp;`).join('\n')+'\n</SAMI>';
    for(const newline of ['\n','\r\n','\r']) {
      const source='\ufeff'+input.replaceAll('\n',newline);
      const result=parse(source,{format});
      assert.deepEqual(result.cues.map(c=>[c.start,c.end,c.text]),expected);
      assert.equal(result.sourceText,source);
      assert.notEqual(result.status,'fatal');
    }
  });
}
test('UTF-8 bytes roundtrip non-ASCII scalar text independently of cue parsing',()=>{
  const next=random(0xdec0de);let text='';
  for(let i=0;i<2000;i++) {let cp=next()%0x110000;if(cp>=0xd800&&cp<=0xdfff)cp=0x20;text+=String.fromCodePoint(cp);}
  assert.equal(decode(new TextEncoder().encode(text)).text,text);
});
test('seeded malformed-content mutations terminate and preserve safety invariants in a child',()=>{
  const entry=new URL('../dist/index.js',import.meta.url).href;
  const code=`import {parse} from ${JSON.stringify(entry)};
    let seed=0x51a7;const next=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const tokens=['<','>','\\\\','{','}','&',';','\\r','\\n','\\0','\\ud800','한국어','00:01.000','-->','<SYNC Start=0>','<P Class=KO>','NOTE','[Events]','Dialogue:','1',' ','"'];
    for(const format of ['srt','vtt','sami','ass','ssa']) for(let i=0;i<512;i++) {
      let text=format==='vtt'?'WEBVTT\\n\\n':'';for(let n=next()%128;n>0;n--)text+=tokens[next()%tokens.length];
      const r=parse(text,{format,limits:{maxDiagnostics:3,maxCues:32}});
      if(r.sourceText!==text||r.diagnostics.length>3)throw Error('source/budget');
      if(r.status==='fatal'&&(r.cues.length||r.tracks.length||r.metadata.length))throw Error('fatal leak');
      for(const c of r.cues){if(!Number.isSafeInteger(c.start)||c.start<0||c.end!==null&&(!Number.isSafeInteger(c.end)||c.end<=c.start))throw Error('time');if(!r.tracks.some(t=>t.id===c.trackId))throw Error('track');if(c.source.line<1||c.source.endLine<c.source.line)throw Error('range');}
    }
    process.stdout.write('2560 cases');`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',code],{timeout:10000,encoding:'utf8',windowsHide:true});
  assert.equal(child.error,undefined,String(child.error));assert.equal(child.status,0,child.stderr);assert.equal(child.stdout,'2560 cases');
});
