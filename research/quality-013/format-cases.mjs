// Independently authored inputs and expectations from the public ASS guide,
// Aegisub tags, and Microsoft SAMI semantics. These are not real-film files.
const ass=(payload,wrap=0,version='ass')=>`[Script Info]\nScriptType: v4.00${version==='ass'?'+':''}\nWrapStyle: ${wrap}\n\n[Events]\nFormat: ${version==='ass'?'Layer':'Marked'}, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: ${version==='ass'?'0':'Marked=0'},0:00:01.20,0:00:03.45,Default,,0,0,0,,${payload}`;
export const formatCases=[
  ...['ass','ssa'].map(format=>({id:`${format}-section-no-empty-line`,format,source:ass('A',0,format).replace('\n\n[Events]','\n[Events]'),expected:[[1200,3450,'A']],rawExpected:[[1200,3450,'A']],basis:'ASS sections use bracket headers; blank lines are not required'})),
  ...[
    ['multilingual','한국어 العربية 日本語 👩🏽‍💻','한국어 العربية 日本語 👩🏽‍💻',0],
    ['linebreaks','A\\NB\\nC\\hD','A\nB C\u00a0D',0],
    ['wrap2','A\\nB\\NC','A\nB\nC',2],
    ['wrap-overrides','{\\q2}A\\nB{\\q0}C\\nD','A\nBC D',0],
    ['drawing','A{\\p1}m 0 0 l 10 10{\\p0}B','AB',0],
    ['karaoke','{\\k20}가{\\kf30}나{\\ko40}다','가나다',0],
    ['comma-text','one,two,three','one,two,three',0],
    ['plain-html-literal','2 < 3 > 1 &amp;','2 < 3 > 1 &amp;',0],
    ['escaped-braces','\\{literal\\}','{literal}',0],
    ['nested-transform','{\\t(0,100,\\clip(m 0 0 l 1 1))}A\\nB','A B',0],
  ].flatMap(([id,payload,text,wrap])=>['ass','ssa'].map(format=>({id:`${format}-${id}`,format,source:ass(payload,wrap,format),expected:[[1200,3450,text]],rawExpected:[[1200,3450,payload]],basis:'libass ASS guide and Aegisub override tags; escaped braces is declared libass extension'}))),
  {id:'sami-two-languages',format:'sami',source:'<SAMI><SYNC Start=1000><P Class=KO>한글<P Class=EN>English<SYNC Start=2000><P Class=KO>다음<SYNC Start=3000></SAMI>',expected:[[1000,2000,'한글'],[1000,3000,'English'],[2000,3000,'다음']],tracks:['KO','EN','KO'],basis:'Microsoft SAMI per-language updates and empty SYNC clear'},
  {id:'sami-nbsp-clear',format:'sami',source:'<SAMI><SYNC Start=1000><P Class=KO>A<SYNC Start=2000><P Class=KO>&nbsp;</SAMI>',expected:[[1000,2000,'A']],basis:'Microsoft NBSP clear'},
  {id:'sami-open-end',format:'sami',source:'<SAMI><SYNC Start=1000><P>A</SAMI>',expected:[[1000,null,'A']],basis:'No end time exists in source; unknown end contract'},
  {id:'sami-ascii-whitespace',format:'sami',source:'<SAMI><SYNC Start=1000><P>\tA\nB\fC &#10; D &#32; E\t<SYNC Start=2000></SAMI>',expected:[[1000,2000,'A B C D E']],basis:'HTML ASCII whitespace collapse in declared SAMI reading projection'},
  {id:'sami-unicode-spaces',format:'sami',source:'<SAMI><SYNC Start=1000><P>&nbsp;A\u2003B\u00a0<SYNC Start=2000></SAMI>',expected:[[1000,2000,'\u00a0A\u2003B\u00a0']],basis:'HTML does not collapse Unicode non-ASCII spaces'},
  {id:'sami-breaks-pre',format:'sami',source:'<SAMI><SYNC Start=1000><P>A<BR>B<pre>  C\n D</pre><SYNC Start=2000></SAMI>',expected:[[1000,2000,'A\nB  C\n D']],basis:'BR linebreak and PRE physical whitespace'},
  {id:'sami-script-inert',format:'sami',source:'<SAMI><SYNC Start=1000><P>A<script><SYNC Start=0><P>fake</script>B<SYNC Start=2000></SAMI>',expected:[[1000,2000,'AB']],basis:'Script raw-text does not create caption structure; no execution'},
  {id:'sami-duplicate-start',format:'sami',source:'<SAMI><SYNC Start=1000 Start=5000><P>A<SYNC Start=2000></SAMI>',expected:[[1000,2000,'A']],basis:'Declared first-attribute recovery; duplicates diagnosed'},
];
