export const stamp = ms => `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;
export function workload(format,count,rich=false) {
  const lines=[];
  for(let i=0;i<count;i++) {
    const text=`Hello ${i} 한국어`,s=i*1000,e=s+(format==='sami'?1000:990);
    const payload=rich?(format==='ass'?`{\\b1}${text}{\\b0}\\Nsecond`:`<b>${text}</b>${format==='vtt'?'\n':'<br>'}second`):text;
    if(format==='srt'||format==='vtt')lines.push(`${i+1}\n${format==='srt'?stamp(s).replace('.',','):stamp(s)} --> ${format==='srt'?stamp(e).replace('.',','):stamp(e)}\n${payload}`);
    else if(format==='ass')lines.push(`Dialogue: 0,${stamp(s).slice(0,-1)},${stamp(e).slice(0,-1)},Default,,0,0,0,,${payload}`);
    else lines.push(`<SYNC Start=${s}><P Class=EN>${payload}`);
  }
  return (format==='vtt'?'WEBVTT\n\n':format==='ass'?'[Script Info]\nScriptType: v4.00+\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n':format==='sami'?'<SAMI><BODY>\n':'')+lines.join(format==='srt'||format==='vtt'?'\n\n':'\n')+(format==='sami'?`\n<SYNC Start=${count*1000}><P Class=EN>&nbsp;</BODY></SAMI>`:'');
}
export function verify(cues,format,count,rich) {
  if(cues.length!==count)throw Error(`cue count ${cues.length} != ${count}`);
  for(let i=0;i<count;i++) {
    const c=cues[i],end=i*1000+(format==='sami'?1000:990),text=`Hello ${i} 한국어${rich?'\nsecond':''}`;
    if(c.start!==i*1000||c.end!==end||c.text!==text)throw Error(`cue ${i}: ${JSON.stringify(c)} != ${JSON.stringify([i*1000,end,text])}`);
  }
}
