import {readFileSync} from 'node:fs';
import {root,wptAssertions,unescape} from './corpus.mjs';
export function checkedWptCases() {
  return wptAssertions().map(f=>{
    const path=f.sourcePath.replace('/file-parsing/tests/support/','/file-parsing/support/').replace(/\.vtt$/,'.test');
    const prelude=readFileSync(new URL(path,root),'utf8').split('\n===\n')[0],assertions=[];
    // Parse only literal operands, including optional diagnostic arguments.
    // Dynamic loops, computed expressions and rendering properties are excluded.
    for(const m of prelude.matchAll(/assert_equals\(cues(?:\[(\d+)\]\.(text|startTime|endTime|id)|\.(length)),\s*('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\d+(?:\.\d+)?)(?=\s*[,\x29])/g)) {
      assertions.push({index:m[1]===undefined?null:Number(m[1]),property:m[2]??m[3],expected:/^["']/.test(m[4])?unescape(m[4].slice(1,-1)):Number(m[4])});
    }
    if(!assertions.length && f.id!=='stylesheets.test')throw Error(`No supported assertions in ${f.id}`);
    return {...f,assertions};
  });
}
export function realOracle(f) {
  if(/TOS-CH(?:-traditional)?\.srt$/.test(f.id))return {expected:null,basis:'Unresolved damaged source: whole-second truncated end plus detached payload; simplified Chinese also inserts blank lines between index, time and text. Do not infer a repair from candidate output.'};
  const basis=[];
  let source=f.source.replace(/\r\n?/g,'\n').replace(/\n+$/,'');
  if(/TOS-PT-(?:BR|PT)\.srt$/.test(f.id)){source=source.replaceAll(' -> ',' --> ');basis.push('Single-dash arrow interpreted as separator, with explicit recovery diagnostic required.');}
  if(f.id.endsWith('TOS-Indonesian.srt')){source=source.replace(/(00:00:45,000)\.(?=\n)/,'$1');basis.push('Cue 9 terminal period is punctuation following a complete 45.000-second clock.');}
  const clock=s=>{const [h,m,se,ms]=s.split(/[:,]/).map(Number);if(m>59||se>59)throw Error('Clock range');return h*3600000+m*60000+se*1000+ms;};
  const expected=source.split(/\n\n+/).map(b=>{
    const [id,timing,...payload]=b.split('\n');
    // Trailing ASCII spaces in structural lines are allowed by this oracle;
    // caption payload, Unicode whitespace and empty cues are not trimmed.
    if(!/^[0-9]+[ \t]*$/.test(id)||!/^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}[ \t]*$/.test(timing))throw Error(`Review oracle for ${f.id} block ${id}`);
    const [s,e]=timing.trimEnd().split(' --> ');return [clock(s),clock(e),payload.join('\n')];
  });
  return {expected,basis:['Independent fixed-width source clock arithmetic; preserve all payload lines, including empty cues.',...basis].join(' ')};
}
export const preservedWptTextDifferences = new Map([
  ...['entities.dat:14','entities.dat:15',...Array.from({length:8},(_,i)=>`tags.dat:${i}`),'timestamps.dat:0','timestamps.dat:1','timestamps.dat:2','timestamps.dat:4','timestamps.dat:5'].map(id=>[id,'Unterminated markup preserved with UNTERMINATED_MARKUP warning; browser recovery discards it.']),
  ...['tags.dat:8','tags.dat:9','timestamps.dat:3'].map(id=>[id,'Unrecognized closed markup preserved with UNKNOWN_MARKUP warning; browser recovery discards it.'])
]);
