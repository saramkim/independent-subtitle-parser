import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../dist/index.js';

// Primary format basis (fixtures independently authored, no application code):
// https://learn.microsoft.com/en-us/previous-versions/windows/desktop/dnacc/understanding-sami-1.0
// https://learn.microsoft.com/en-us/previous-versions/windows/desktop/wmp/sami-file-example
// Oracle policy for omitted class updates: only an explicit paragraph updates a track.
// Unknown final end and malformed recovery are documented library policies, not invented timestamps.
const sami = text => parse(text, { format: 'sami' });
const has = (result, code) => result.diagnostics.some(d => d.code === code);

test('SAMI milliseconds, omitted close tags, BR, NBSP clear and unknown final end', () => {
  const result = sami('<SAMI><BODY>\n<SYNC Start=25><P>one<BR>two\n<SYNC Start=1025><P>&nbsp;\n<SYNC Start=2025><P>three</BODY></SAMI>');
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.cues.map(c => [c.start, c.end, c.text]), [[25, 1025, 'one\ntwo'], [2025, null, 'three']]);
  assert.equal(result.metadata.find(m => m.kind === 'sami-clear').fields.find(f => f.name === 'start').value, '1025');
});

test('SAMI multilingual classes, localized labels and Source paragraphs remain distinct', () => {
  const source = `<SaMi><HeAd><STYLE><!--
  /* independently authored metadata fixture */
  .EN { Name: 'English Captions'; LANG: en-US; SAMIType: CC; }
  P.KO { Name: "한국어"; lang: ko-KR; }
  .AR { Name: Arabic; lang: ar; }
  --></STYLE></HeAd><BODY>
  <SYNC Start="100"><P Class=EN ID=Source>Narrator<P CLASS=EN>Hello &eacute; &amp; bye
  <P Class='KO'>안녕<BR/>세계<P Class=AR>مرحبا
  <SYNC Start='300'><P Class=KO>&#160;
  <SYNC Start=500><P Class=EN>Later<P Class=AR>&nbsp;
  </BODY></SAMI>`;
  const result = sami(source);
  assert.deepEqual(result.tracks.map(t => [t.sourceClass, t.label, t.language]), [['EN', 'English Captions', 'en-US'], ['KO', '한국어', 'ko-KR'], ['AR', 'Arabic', 'ar']]);
  assert.equal(result.tracks[0].kind, 'CC');
  assert.deepEqual(result.cues.map(c => [c.start, c.end, c.text]), [[100, 500, 'Narrator\nHello é & bye'], [100, 300, '안녕\n세계'], [100, 500, 'مرحبا'], [500, null, 'Later']]);
  assert.ok(result.cues[0].fields.some(f => f.name === 'p.0.id' && f.value === 'Source'));
  assert.ok(result.cues[0].rawText.includes('&eacute;'));
  assert.equal(result.sourceText, source);
});

test('SAMI missing class update leaves other language active; final ends remain unknown', () => {
  const result = sami('<SAMI><SYNC Start=0><P Class=A>alpha<P Class=B>beta<SYNC Start=1000><P Class=A>next</SAMI>');
  assert.deepEqual(result.cues.map(c => [c.trackId, c.start, c.end]), [['sami:class:A', 0, 1000], ['sami:class:B', 0, null], ['sami:class:A', 1000, null]]);
});

test('SAMI empty SYNC closes all active blocks per historical Microsoft guidance', () => {
  // https://www.w3.org/WAI/sami.html §4.9: an empty SYNC closes/hides the block.
  const result = sami('<SAMI><SYNC Start=0><P Class=EN>keep<P Class=KO>유지<SYNC Start=50><!-- no caption --></SAMI>');
  assert.deepEqual(result.cues.map(c => c.end), [50, 50]);
  assert.ok(result.metadata.some(m => m.kind === 'sami-clear-all'));
});

test('SAMI head duration is preserved and cannot manufacture a final cue end', () => {
  const result = sami('<SAMI><HEAD><SAMIParam>Metrics {time:ms; duration:9000;} Spec {MSFT:1.0;}</SAMIParam></HEAD><SYNC Start=10><P>last</SAMI>');
  assert.equal(result.cues[0].end, null);
  assert.ok(result.metadata.some(m => m.kind === 'sami-samiparam' && m.raw.includes('duration:9000')));
});

test('SAMI non-ms declared metrics are fatal, never relabeled milliseconds', () => {
  const result = sami('<SAMI><HEAD><SAMIParam>Metrics {time:frames; duration:999;}</SAMIParam></HEAD><SYNC Start=24><P>frame</SAMI>');
  assert.equal(result.status, 'fatal');
  assert.equal(result.cues.length, 0);
  assert.ok(has(result, 'SAMI_UNSUPPORTED_TIME_UNIT'));
});

test('SAMI historical TimeStamp units cannot be silently relabeled milliseconds', () => {
  for (const unit of ['Frame', 'SMPTE']) {
    const result = sami(`<SAMI><SAMIParam>TimeStamp=${unit}</SAMIParam><SYNC Start=25><P>not milliseconds</SAMI>`);
    assert.equal(result.status, 'fatal');
    assert.ok(has(result, 'SAMI_UNSUPPORTED_TIME_UNIT'));
  }
  const result = sami('<SAMI><SAMIParam>Copyright="Text TimeStamp=Frame" TimeStamp=ms</SAMIParam><SYNC Start=25><P>milliseconds</SAMI>');
  assert.equal(result.status, 'ok');
  assert.equal(result.cues[0].start, 25);
});

test('SAMI CSS strings preserve comment-looking content and raw less-than characters', () => {
  const result = sami('<SAMI><STYLE>.EN { Name: "English /* label */ <b"; lang: en; }</STYLE><SYNC Start=0><P Class=EN>visible</SAMI>');
  assert.equal(result.tracks[0].label, 'English /* label */ <b');
  assert.equal(result.cues[0].text, 'visible');
});

test('SAMI significant entity spaces and attribute ambiguous ampersands survive', () => {
  const result = sami('<SAMI><SYNC Start=0><P Class="&notit=">&nbsp;word&nbsp;&emsp;</SAMI>');
  assert.equal(result.cues[0].text, '\u00a0word\u00a0\u2003');
  assert.equal(result.tracks[0].sourceClass, '&notit=');
});

test('SAMI text outside an explicitly closed paragraph is recovered with a diagnostic', () => {
  const result = sami('<SAMI><SYNC Start=0>before<P Class=EN>inside</P>after</SAMI>');
  assert.deepEqual(result.cues.map(c => [c.trackId, c.text]), [['sami:default', 'before\nafter'], ['sami:class:EN', 'inside']]);
  assert.ok(has(result, 'SAMI_UNASSIGNED_TEXT'));
});

test('SAMI content after closing root stays in metadata, without being parsed as cues', () => {
  const result = sami('<SAMI><SYNC Start=0><P>visible</SAMI><SYNC Start=100><P>scratchpad');
  assert.equal(result.cues.length, 1);
  assert.ok(result.metadata.some(m => m.kind === 'sami-trailing' && m.raw.includes('scratchpad')));
});

test('SAMI duplicate SYNC starts use first value and diagnose conflicting input', () => {
  const result = sami('<SAMI><SYNC Start=10 Start=20><P>text</SAMI>');
  assert.equal(result.cues[0].start, 10);
  assert.ok(has(result, 'SAMI_DUPLICATE_ATTRIBUTE'));
});

test('SAMI bad, negative, decimal and overflowing timestamps cannot shift onto valid time', () => {
  const source = '<SAMI>' + ['-1', '1.5', 'no', '9007199254740992'].map(start => `<SYNC Start=${start}><P>bad`).join('') + '<SYNC Start=123><P>good</SAMI>';
  const result = sami(source);
  assert.deepEqual(result.cues.map(c => [c.start, c.text]), [[123, 'good']]);
  assert.equal(result.diagnostics.filter(d => d.code === 'SAMI_INVALID_START').length, 4);
});

test('SAMI decreasing and repeated timestamps preserve content and expose ambiguous ends', () => {
  const result = sami('<SAMI><SYNC Start=100><P>a<SYNC Start=50><P>b<SYNC Start=50><P>c</SAMI>');
  assert.deepEqual(result.cues.map(c => [c.start, c.end, c.text]), [[100, null, 'a'], [50, null, 'b'], [50, null, 'c']]);
  assert.ok(has(result, 'SAMI_NON_INCREASING_SYNC'));
  assert.ok(has(result, 'SAMI_AMBIGUOUS_END'));
});

test('SAMI quote-aware tags, literal less-than, HTML entities and attribute duplicates', () => {
  const result = sami('<SAMI><SYNC Start=0><P CLASS="__proto__" class="other"><font title="a > b">2 < 3 &lt; 4 &#x1F642;</font></SAMI>');
  assert.equal(result.cues[0].text, '2 < 3 < 4 🙂');
  assert.equal(result.cues[0].trackId, 'sami:class:__proto__');
  assert.equal(result.cues[0].fields.filter(f => f.name.endsWith('.class')).length, 2);
  assert.ok(has(result, 'SAMI_DUPLICATE_ATTRIBUTE'));
  assert.equal(Object.prototype.polluted, undefined);
});

test('SAMI inline unknown markup preserves text and raw; comments and scripts never become cues', () => {
  const source = '<SAMI><SYNC Start=0><P><unknown>shown</unknown><!-- <SYNC Start=2><P>fake --><script><SYNC Start=5><P>bad()</script><IMG SRC="https://example.invalid/image" ALT="description"></SAMI>';
  const result = sami(source);
  assert.equal(result.cues.length, 1);
  assert.equal(result.cues[0].text, 'showndescription');
  assert.ok(result.cues[0].rawText.includes('<script>'));
  assert.ok(has(result, 'SAMI_UNKNOWN_TAG'));
  assert.ok(has(result, 'SAMI_NON_TEXT_CONTENT'));
  assert.ok(has(result, 'SAMI_IMAGE_NOT_RENDERED'));
});

test('SAMI physical whitespace follows HTML projection, PRE and BR preserve authored breaks', () => {
  const result = sami('<SAMI><SYNC Start=0><P>line\n   continuation<br>break<SYNC Start=100><P><pre>  left\n right  </pre></SAMI>');
  assert.equal(result.cues[0].text, 'line continuation\nbreak');
  assert.equal(result.cues[1].text, '  left\n right  ');
  assert.ok(result.cues[0].rawText.includes('\n   continuation'));
});

test('SAMI malformed close quote and unclosed comment are bounded and diagnosed', () => {
  const result = sami('<SAMI><SYNC Start=0><P>visible<font title="unfinished');
  assert.ok(has(result, 'SAMI_MALFORMED_TAG'));
  assert.ok(result.cues[0].text.includes('visible'));
  const comment = sami('<SAMI><SYNC Start=0><P>visible<!-- unfinished');
  assert.equal(comment.cues[0].text, 'visible');
  assert.ok(has(comment, 'SAMI_MALFORMED_TAG'));
});

test('SAMI fragment with missing P recovers text explicitly into default track', () => {
  const result = sami('<SYNC Start=7>fragment<BR>line');
  assert.deepEqual(result.cues.map(c => [c.start, c.text]), [[7, 'fragment\nline']]);
  assert.ok(has(result, 'SAMI_MISSING_ROOT'));
  assert.ok(has(result, 'SAMI_MISSING_PARAGRAPH'));
});

test('SAMI large independently calculated timeline and cue limit', () => {
  const count = 10000;
  const source = '<SAMI>\n' + Array.from({ length: count }, (_, i) => `<SYNC Start=${i * 37}><P Class=EN>cue ${i}\n`).join('') + '</SAMI>';
  const result = sami(source);
  assert.equal(result.cues.length, count);
  assert.equal(result.cues[8765].start, 324305);
  assert.equal(result.cues[8765].end, 324342);
  assert.equal(result.cues.at(-1).end, null);
  const limited = parse(source, { format: 'sami', limits: { maxCues: 10 } });
  assert.equal(limited.status, 'fatal');
  assert.equal(limited.cues.length, 0);
  assert.ok(has(limited, 'CUE_LIMIT'));
});
