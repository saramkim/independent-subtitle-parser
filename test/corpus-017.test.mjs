import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '../dist/index.js';

test('SSA blank lines inside Events do not end the section; raw edge spaces survive',()=>{
 const source='[Script Info]\nScriptType: v4.00\n[Events]\nFormat: Marked, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n\n\nDialogue: Marked=0,0:00:01.00,0:00:02.00,Default,,0,0,0,,  العربية עברית  \n';
 const r=parse(source);
 assert.equal(r.format,'ssa');
 assert.equal(r.cues.length,1);
 assert.deepEqual([r.cues[0].start,r.cues[0].end,r.cues[0].rawText],[1000,2000,'  العربية עברית  ']);
});

test('legacy SAMI authoring commands are opaque metadata, not caption text or extra cues',()=>{
 const commands=['<SpanID="0">','<SpanID:1000; DisplayImg:0;>','<ShowImg=02:Slide 2: a description;>','<DisplayImg:0;>'];
 const source=`<SAMI><SYNC Start=0><P Class=EN>First${commands[0]}<SYNC Start=1000><P Class=EN>&nbsp;${commands[1]}${commands[2]}<SYNC Start=2000><P Class=EN>Last${commands[3]}</SAMI>`;
 const r=parse(source);
 assert.deepEqual(r.cues.map(c=>[c.start,c.end,c.text]),[[0,1000,'First'],[2000,null,'Last']]);
 assert.deepEqual(r.metadata.filter(m=>m.kind==='sami-legacy-command').map(m=>m.raw),commands);
 assert.equal(r.diagnostics.filter(d=>d.code==='SAMI_LEGACY_COMMAND_UNAPPLIED').length,1);
 assert.equal(r.status,'partial');assert.equal(r.sourceText,source);
 assert.ok(r.cues[0].rawText.includes(commands[0]));
 assert.ok(r.metadata.find(m=>m.kind==='sami-clear').raw.includes(commands[2]));
});
test('legacy command metadata retains timing/class context, quoted delimiters and case',()=>{
 const r=parse('<SAMI><SYNC Start=50><P Class=KO>a<sPaNiD="a>b">b<P Class=EN>c<ShowImg="x>y"></SAMI>');
 assert.deepEqual(r.cues.map(c=>c.text),['ab','c']);
 const m=r.metadata.filter(m=>m.kind==='sami-legacy-command');
 assert.deepEqual(m.map(m=>m.fields.map(f=>[f.name,f.value])),[
  [['command','spanid'],['start','50'],['class','KO']],
  [['command','showimg'],['start','50'],['class','EN']]
 ]);
 for(const newline of ['\n','\r','\r\n']){
  const source=`<SAMI>${newline}<ShowImg="first${newline}second"><SYNC Start=0><P>x</SAMI>`;
  const result=parse(source),command=result.metadata.find(m=>m.kind==='sami-legacy-command');
  assert.equal(result.sourceText,source);
  assert.equal(command.raw,'<ShowImg="first\nsecond">');
  assert.deepEqual(command.source,{line:2,endLine:3});
  assert.deepEqual(command.fields,[{name:'command',value:'showimg'}]);
 }
});
test('incomplete legacy commands cannot consume later SYNC; unfamiliar spellings stay visible',()=>{
 for(const raw of ['<SpanID:unfinished','<ShowImg="unfinished']){
  const r=parse(`<SAMI><SYNC Start=0><P>${raw}<SYNC Start=1000><P>later</SAMI>`);
  assert.ok(r.cues.some(c=>c.start===1000&&c.text==='later'));
  assert.ok(r.cues[0].text.includes(raw));
  assert.ok(r.diagnostics.some(d=>d.code==='SAMI_MALFORMED_TAG'));
 }
 const r=parse('<SAMI><SYNC Start=0><P>&lt;SpanID:1;&gt; <SpanIDExtra=3> literal</SAMI>');
 assert.ok(r.cues[0].text.includes('<SpanID:1;>'));
 assert.ok(r.cues[0].text.includes('<SpanIDExtra=3>'));
 assert.equal(r.metadata.filter(m=>m.kind==='sami-legacy-command').length,0);
});
test('commands in comments and script/style raw text are never treated as active commands',()=>{
 const r=parse('<SAMI><STYLE>/* <SpanID:0;> */</STYLE><SYNC Start=0><P>a<!-- <ShowImg=1;> --><script><SpanID:3;></script>b</SAMI>');
 assert.equal(r.cues[0].text,'ab');
 assert.equal(r.metadata.filter(m=>m.kind==='sami-legacy-command').length,0);
});
test('unquoted command descriptions may contain apostrophes without swallowing later captions',()=>{
 const r=parse('<SAMI><SYNC Start=0><P>A<ShowImg=02: children\'s slide;><SYNC Start=1000><P>B</SAMI>');
 assert.deepEqual(r.cues.map(c=>[c.start,c.end,c.text]),[[0,1000,'A'],[1000,null,'B']]);
 assert.equal(r.metadata.filter(m=>m.kind==='sami-legacy-command').length,1);
});

test('large command streams preserve all metadata and cue budgets fail closed',()=>{
 const count=10000;
 const source='<SAMI>'+Array.from({length:count},(_,i)=>`<SYNC Start=${i*1000}><P>x<SpanID:${i};>`).join('')+'<SYNC Start=10000000></SAMI>';
 const r=parse(source);
 assert.equal(r.cues.length,count);
 assert.equal(r.cues.at(-1).end,10000000);
 assert.equal(r.metadata.filter(m=>m.kind==='sami-legacy-command').length,count);
 assert.equal(r.diagnostics.filter(d=>d.code==='SAMI_LEGACY_COMMAND_UNAPPLIED').length,1);
 const limited=parse(source,{limits:{maxCues:10}});
 assert.equal(limited.status,'fatal');
 assert.deepEqual([limited.cues,limited.metadata,limited.tracks],[[],[],[]]);
 assert.equal(limited.sourceText,source);
});
