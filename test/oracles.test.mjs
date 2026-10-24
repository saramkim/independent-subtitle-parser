import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { decode, detectFormat, parse } from '../dist/index.js';

// Inputs and values were authored from public specifications and explicit package
// policies before implementation inspection. See docs/SOURCES.md for provenance.
const hasIssue = (result, minimum = 'warning') => {
  const levels = { info: 0, warning: 1, error: 2, fatal: 3 };
  assert.ok(result.diagnostics.some((d) => levels[d.severity] >= levels[minimum]),
    `expected ${minimum} diagnostic, got ${JSON.stringify(result.diagnostics)}`);
};
const assFile = (events, extraInfo = '') => `[Script Info]\nScriptType: v4.00+\n${extraInfo}[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${events}`;
const dialogue = (text, start = '0:00:01.00', end = '0:00:02.00') =>
  `Dialogue: 0,${start},${end},Default,Speaker,0,0,0,,${text}`;
const fieldValue = (cue, name) => cue.fields?.find((f) => f.name.toLowerCase() === name.toLowerCase())?.value;

test('SRT baseline: millisecond arithmetic, exact Unicode, CRLF and payload spaces', () => {
  const input = '17\r\n01:02:03,004 --> 01:02:04,987\r\n  한국어 日本語 العربية e\u0301 👩🏽‍🚀  \r\nsecond line\r\n';
  const result = parse(input);
  assert.equal(result.format, 'srt');
  assert.equal(result.cues.length, 1);
  assert.deepEqual([result.cues[0].start, result.cues[0].end], [3723004, 3724987]);
  assert.equal(result.cues[0].text, '  한국어 日本語 العربية e\u0301 👩🏽‍🚀  \nsecond line');
  assert.equal(result.cues[0].id, '17');
  assert.equal(result.sourceText, input);
});

test('SRT has no caption-length truncation and retains overlapping cues', () => {
  const long = 'abcdefghijklmnop'.repeat(20);
  const result = parse(`1\n00:00:01,000 --> 00:00:04,000\n${long}\n\n2\n00:00:02,000 --> 00:00:03,000\nB`);
  assert.deepEqual(result.cues.map((c) => [c.start, c.end]), [[1000, 4000], [2000, 3000]]);
  assert.equal(result.cues[0].text, long);
});

test('SRT basic markup/entities project to text while raw payload preserves information', () => {
  const raw = '<i>Hello</i> &amp; &lt;world&gt;\n<b>가</b>';
  const result = parse(`1\n00:00:00,000 --> 00:00:01,000\n${raw}`, { format: 'srt' });
  assert.equal(result.cues[0].rawText, raw);
  assert.equal(result.cues[0].text, 'Hello & <world>\n가');
});

test('SRT literal arrow text is payload rather than a cue boundary', () => {
  const result = parse('1\n00:00:00,000 --> 00:00:01,000\nlook --> there\nsecond line');
  assert.deepEqual(result.cues.map((c) => c.text), ['look --> there\nsecond line']);
});

test('SRT quoted greater-than attribute content does not leak into reading text', () => {
  const raw = '<font title="a > b" color="red">Hello</font>';
  const result = parse(`1\n00:00:00,000 --> 00:00:01,000\n${raw}`);
  assert.equal(result.cues[0].text, 'Hello');
  assert.equal(result.cues[0].rawText, raw);
});

test('SRT recovery accepts a documented dot separator and absent index with a warning', () => {
  const result = parse('00:00:01.250 --> 00:00:02.500\nrecovered', { format: 'srt' });
  assert.deepEqual(result.cues.map((c) => [c.start, c.end, c.text]), [[1250, 2500, 'recovered']]);
  assert.equal(result.status, 'partial');
  hasIssue(result);
});

test('SRT malformed minute and reversed interval do not erase a later valid cue', () => {
  const input = '1\n00:61:00,000 --> 00:62:00,000\nbad minute\n\n2\n00:00:05,000 --> 00:00:03,000\nreversed\n\n3\n00:00:06,000 --> 00:00:07,000\nvalid';
  const result = parse(input, { format: 'srt' });
  assert.deepEqual(result.cues.map((c) => [c.start, c.end, c.text]), [[6000, 7000, 'valid']]);
  assert.equal(result.status, 'partial');
  assert.equal(result.sourceText, input);
  hasIssue(result);
});

test('SRT unsafe timestamps never round into valid numeric cue times', () => {
  const result = parse('1\n9999999999999999:00:00,000 --> 9999999999999999:00:01,000\nunsafe', { format: 'srt' });
  assert.equal(result.cues.length, 0);
  hasIssue(result, 'error');
});

test('WebVTT short and hour timestamps use fixed millisecond precision', () => {
  const result = parse('WEBVTT\n\nshort\n02:03.004 --> 02:04.005\nA\n\nhour\n01:02:03.004 --> 01:02:04.005\nB');
  assert.equal(result.format, 'vtt');
  assert.deepEqual(result.cues.map((c) => [c.id, c.start, c.end]), [['short', 123004, 124005], ['hour', 3723004, 3724005]]);
});

test('WebVTT retains settings, metadata, and voice/language/ruby/timestamp markup', () => {
  const raw = '<v Narrator><lang ko>한국어</lang> <ruby>漢<rt>かん</rt></ruby> <00:00:01.500>end</v>';
  const input = `WEBVTT sample\n\nNOTE newly authored note\nkeep this\n\nSTYLE\n::cue { color: lime; }\n\nREGION\nid:r1\nwidth:40%\n\ncue-one\n00:00:01.000 --> 00:00:03.000 region:r1 align:start position:12.5%,line-left\n${raw}`;
  const result = parse(input);
  assert.equal(result.cues.length, 1);
  assert.equal(result.cues[0].id, 'cue-one');
  assert.equal(result.cues[0].rawText, raw);
  assert.equal(result.cues[0].settings, 'region:r1 align:start position:12.5%,line-left');
  assert.ok(result.metadata.some((m) => m.raw.includes('newly authored note')));
  assert.ok(result.metadata.some((m) => m.raw.includes('color: lime')));
  assert.ok(result.metadata.some((m) => m.raw.includes('width:40%')));
  assert.equal(result.sourceText, input);
});

test('WebVTT accepts BOM, CR newlines, and overlapping cue intervals', () => {
  const result = parse('\uFEFFWEBVTT\r\r00:01.000 --> 00:04.000\rA\r\r00:02.000 --> 00:03.000\rB');
  assert.equal(result.cues.length, 2);
  assert.deepEqual(result.cues.map((c) => [c.start, c.end]), [[1000, 4000], [2000, 3000]]);
});

test('WebVTT header is required even with explicit format', () => {
  const result = parse('00:01.000 --> 00:02.000\nA', { format: 'vtt' });
  assert.equal(result.status, 'fatal');
  assert.equal(result.cues.length, 0);
  hasIssue(result, 'fatal');
});

test('WebVTT malformed timestamp fractions and ranges recover to later valid block', () => {
  const result = parse('WEBVTT\n\n00:01.1 --> 00:02.000\nbad fraction\n\n00:60.000 --> 01:01.000\nbad seconds\n\n00:03.000 --> 00:04.000\ngood');
  assert.deepEqual(result.cues.map((c) => [c.start, c.end, c.text]), [[3000, 4000, 'good']]);
  hasIssue(result);
});

test('WebVTT cue text never executes script or removes raw unrecognized tags', () => {
  const raw = '<script>globalThis.__subtitleExecuted = true</script><b>safe</b>';
  const result = parse(`WEBVTT\n\n00:00.000 --> 00:01.000\n${raw}`);
  assert.equal(result.cues[0].rawText, raw);
  assert.equal(globalThis.__subtitleExecuted, undefined);
});

test('WebVTT 2026 character references include HTML names and numeric code points', () => {
  // W3C 2026 CR sections 4.2.2 and 6.4 reference the HTML character-reference rules.
  const raw = '&#xAC00; &copy; &#128512; &amp;lt;';
  const result = parse(`WEBVTT\n\n00:00.000 --> 00:01.000\n${raw}`);
  assert.equal(result.cues[0].text, '가 © 😀 &lt;');
  assert.equal(result.cues[0].rawText, raw);
});

test('WebVTT classes apply to span components other than c', () => {
  const raw = '<b.loud>Hi</b> <v.narration Speaker>there</v> <lang.local ko>안녕</lang>';
  const result = parse(`WEBVTT\n\n00:00.000 --> 00:01.000\n${raw}`);
  assert.equal(result.cues[0].text, 'Hi there 안녕');
  assert.equal(result.cues[0].rawText, raw);
});

test('WebVTT NOTE tab separator after a cue is not a late STYLE block', () => {
  const result = parse('WEBVTT\n\n00:00.000 --> 00:01.000\nA\n\nNOTE\tcomment\nretained');
  assert.equal(result.status, 'ok');
  assert.equal(result.cues.length, 1);
  assert.ok(result.metadata.some((m) => m.raw.includes('NOTE\tcomment')));
});

test('SAMI keeps language classes separate and derives end per class', () => {
  const input = `<SAMI><HEAD><STYLE><!--
.KRCC { Name: Korean; lang: ko-KR; SAMIType: CC; }
.ENCC { Name: English; lang: en-US; SAMIType: CC; }
--></STYLE></HEAD><BODY>
<SYNC Start=1000><P Class=KRCC>안녕<BR>세상<P Class=ENCC>Hello
<SYNC Start=1500><P Class=KRCC>다음
<SYNC Start=2000><P Class=ENCC>&nbsp;
<SYNC Start=3000><P Class=KRCC>&nbsp;
</BODY></SAMI>`;
  const result = parse(input);
  assert.equal(result.format, 'sami');
  const korean = result.tracks.find((track) => track.sourceClass?.toLowerCase() === 'krcc');
  const english = result.tracks.find((track) => track.sourceClass?.toLowerCase() === 'encc');
  assert.ok(korean);
  assert.ok(english);
  assert.equal(korean.language, 'ko-KR');
  assert.equal(english.language, 'en-US');
  assert.equal(korean.label, 'Korean');
  assert.equal(english.label, 'English');
  assert.deepEqual(result.cues.filter((c) => c.trackId === korean.id && c.text.trim()).map((c) => [c.start, c.end, c.text]), [[1000, 1500, '안녕\n세상'], [1500, 3000, '다음']]);
  assert.deepEqual(result.cues.filter((c) => c.trackId === english.id && c.text.trim()).map((c) => [c.start, c.end, c.text]), [[1000, 2000, 'Hello']]);
  assert.equal(result.sourceText, input);
});

test('SAMI final end remains unknown rather than silently assigning a duration', () => {
  const result = parse('<SAMI><BODY><SYNC Start="1200"><P Class="ko">끝</P></BODY></SAMI>');
  assert.equal(result.cues.length, 1);
  assert.deepEqual([result.cues[0].start, result.cues[0].end, result.cues[0].text], [1200, null, '끝']);
  // Policy: an explicit null end is valid data; an informational diagnostic is
  // sufficient. The SAMI source imposes no severity or invented end duration.
  hasIssue(result, 'info');
});

test('SAMI quoted angle bracket and mixed-case structural tags preserve payload', () => {
  const result = parse('<sami><body><sync START="10"><p CLASS="A"><font title="a > b">one &amp; two</font><br/>三<sync start="20"><p class="A">&nbsp;</body></sami>');
  const cue = result.cues.find((c) => c.text.trim());
  assert.deepEqual([cue.start, cue.end, cue.text], [10, 20, 'one & two\n三']);
  assert.ok(cue.rawText.includes('title="a > b"'));
});

test('SAMI invalid Start is diagnosed without losing the next valid SYNC', () => {
  const result = parse('<SAMI><BODY><SYNC Start=NaN><P Class=EN>bad<SYNC Start=100><P Class=EN>valid<SYNC Start=200><P Class=EN>&nbsp;</BODY></SAMI>');
  assert.deepEqual(result.cues.filter((c) => c.text.trim()).map((c) => [c.start, c.end, c.text]), [[100, 200, 'valid']]);
  hasIssue(result);
});

test('SAMI CSS comments inside quoted label strings remain literal', () => {
  const result = parse('<SAMI><HEAD><STYLE>.EN {Name: "English /* label */"; lang: en;}</STYLE></HEAD><BODY><SYNC Start=0><P Class=EN>A<SYNC Start=1><P Class=EN>&nbsp;</BODY></SAMI>');
  assert.equal(result.tracks.find((track) => track.sourceClass === 'EN').label, 'English /* label */');
});

test('ASS uses centiseconds, keeps Text commas, and retains nontext fields', () => {
  const result = parse(assFile(dialogue('Hello, world', '1:02:03.04', '1:02:04.56')));
  assert.equal(result.format, 'ass');
  assert.equal(result.cues.length, 1);
  assert.deepEqual([result.cues[0].start, result.cues[0].end, result.cues[0].text], [3723040, 3724560, 'Hello, world']);
  assert.equal(fieldValue(result.cues[0], 'Name'), 'Speaker');
  assert.equal(fieldValue(result.cues[0], 'Style'), 'Default');
});

test('ASS hard break, default soft break, hard space, and raw overrides are distinct', () => {
  const raw = String.raw`{\i1}A\NB\nC\hD{\i0}`;
  const result = parse(assFile(dialogue(raw)));
  assert.equal(result.cues[0].text, 'A\nB C\u00A0D');
  assert.equal(result.cues[0].rawText, raw);
});

test('ASS WrapStyle 2 turns soft breaks into forced line breaks', () => {
  const result = parse(assFile(dialogue(String.raw`A\nB\NC`), 'WrapStyle: 2\n'));
  assert.equal(result.cues[0].text, 'A\nB\nC');
});

test('ASS drawing instructions remain raw and do not appear as spoken text', () => {
  const raw = String.raw`{\p1}m 0 0 l 10 10{\p0}visible`;
  const result = parse(assFile(dialogue(raw)));
  assert.equal(result.cues[0].text, 'visible');
  assert.equal(result.cues[0].rawText, raw);
  assert.ok(result.diagnostics.length > 0, 'unsupported drawing presentation must be disclosed');
});

test('ASS comments and headers remain inspectable without becoming displayed cues', () => {
  const input = assFile(`${dialogue('visible')}\nComment: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,private note`, 'Title: Newly authored\n');
  const result = parse(input);
  assert.deepEqual(result.cues.map((c) => c.text), ['visible']);
  assert.ok(result.metadata.some((m) => m.raw.includes('private note')));
  assert.ok(result.metadata.some((m) => m.raw.includes('Newly authored')));
  assert.equal(result.sourceText, input);
});

test('SSA v4 Marked field is supported without assuming ASS Layer syntax', () => {
  const input = '[Script Info]\nScriptType: v4.00\n[Events]\nFormat: Marked, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: Marked=0,0:00:00.01,0:00:01.23,Default,,0,0,0,,SSA';
  const result = parse(input);
  assert.equal(result.format, 'ssa');
  assert.deepEqual(result.cues.map((c) => [c.start, c.end, c.text]), [[10, 1230, 'SSA']]);
  assert.equal(fieldValue(result.cues[0], 'Marked'), 'Marked=0');
});

test('legacy SSA Timer scaling is explicitly disclosed when retaining literal event times', () => {
  // Package policy: retain event timestamps, rather than silently pretending a
  // partial parser applies the original editor's playback-clock multiplier.
  const input = '[Script Info]\nScriptType: v4.00\nTimer: 50.0000\n[Events]\nFormat: Marked, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: Marked=0,0:00:01.00,0:00:02.00,Default,,0,0,0,,SSA';
  const result = parse(input);
  assert.deepEqual(result.cues.map((c) => [c.start, c.end]), [[1000, 2000]]);
  assert.ok(result.metadata.some((m) => m.raw.includes('Timer: 50.0000')));
  hasIssue(result);
});

test('ASS custom format extension follows declared columns and retains Text commas', () => {
  const input = '[Script Info]\nScriptType: v4.00+\n[Events]\nFormat: End, Start, Text\nDialogue: 0:00:02.00,0:00:01.00,A,B,C';
  const result = parse(input);
  assert.deepEqual(result.cues.map((c) => [c.start, c.end, c.text]), [[1000, 2000, 'A,B,C']]);
});

test('ASS malformed timing does not consume later Dialogue events', () => {
  const result = parse(assFile(`${dialogue('bad', '0:00:NaN', '0:00:02.00')}\n${dialogue('good', '0:00:03.00', '0:00:04.00')}`));
  assert.deepEqual(result.cues.map((c) => [c.start, c.end, c.text]), [[3000, 4000, 'good']]);
  hasIssue(result);
});

test('format detection refuses unrelated prose and distinguishes signatures', () => {
  assert.equal(detectFormat('An ordinary note without subtitle structure').confidence, 'none');
  assert.equal(detectFormat('WEBVTT\n\n').format, 'vtt');
  assert.equal(detectFormat('<SAMI><BODY></BODY></SAMI>').format, 'sami');
  assert.equal(detectFormat('[Script Info]\nScriptType: v4.00+\n[Events]').format, 'ass');
  assert.equal(detectFormat('[Script Info]\nScriptType: v4.00\n[Events]').format, 'ssa');
});

test('unknown input is an explicit fatal result, not a successful empty subtitle', () => {
  const input = 'This is neither a subtitle file nor an empty document.';
  const result = parse(input);
  assert.equal(result.status, 'fatal');
  assert.equal(result.cues.length, 0);
  assert.equal(result.sourceText, input);
  hasIssue(result, 'fatal');
});

test('dot timings without a VTT signature remain ambiguous until caller selects format', () => {
  const input = '00:00:01.000 --> 00:00:02.000\nA';
  assert.equal(detectFormat(input).confidence, 'ambiguous');
  assert.equal(parse(input).status, 'fatal');
  assert.equal(parse(input, { format: 'srt' }).cues[0].text, 'A');
});

test('resource-limit failures return no misleading partial cues and preserve source', () => {
  const input = '1\n00:00:00,000 --> 00:00:01,000\nA\n\n2\n00:00:01,000 --> 00:00:02,000\nB';
  for (const limits of [{ maxInputLength: 3 }, { maxLines: 3 }, { maxLineLength: 3 }, { maxCues: 1 }]) {
    const result = parse(input, { format: 'srt', limits });
    assert.equal(result.status, 'fatal');
    assert.deepEqual(result.cues, []);
    assert.equal(result.sourceText, input);
    hasIssue(result, 'fatal');
  }
});

test('diagnostic budgets retain a failure signal and final fatal reason', () => {
  const result = parse('00:00:00.000 --> 00:00:01.000\nA\n\n00:00:01.000 --> 00:00:02.000\nB', { format: 'srt', limits: { maxCues: 1, maxDiagnostics: 1 } });
  assert.equal(result.status, 'fatal');
  assert.equal(result.diagnostics.length, 1);
  hasIssue(result, 'fatal');
});

test('SAMI adversarial comment prefixes do not cause exponential detection work', () => {
  // Isolation gives the regression a real timeout even if synchronous regex work
  // blocks its event loop. This is a security budget, not a format conformance rule.
  const entry = new URL('../dist/index.js', import.meta.url).href;
  const code = `import {detectFormat} from ${JSON.stringify(entry)}; const r=detectFormat('<!--x-->'.repeat(1000)+'ordinary text'); if(r.confidence!=='none')process.exit(2); process.stdout.write('done');`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], { timeout: 5000, encoding: 'utf8' });
  assert.equal(child.error, undefined, String(child.error));
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, 'done');
});

test('byte decoding recognizes UTF-8, UTF-16LE, UTF-16BE BOMs', () => {
  assert.equal(decode(Uint8Array.of(0xef, 0xbb, 0xbf, 0x41)).text, 'A');
  assert.equal(decode(Uint8Array.of(0xff, 0xfe, 0x41, 0x00, 0x00, 0xac)).text, 'A가');
  assert.equal(decode(Uint8Array.of(0xfe, 0xff, 0x00, 0x41, 0xac, 0x00)).text, 'A가');
});

test('invalid UTF-8 is fatal by default, replacement must be explicit and diagnosed', () => {
  const bytes = Uint8Array.of(0xc3, 0x28);
  const strict = decode(bytes);
  assert.equal(strict.text, null);
  hasIssue(strict, 'fatal');
  const lenient = decode(bytes, { fatal: false });
  assert.equal(lenient.text, '\uFFFD(');
  hasIssue(lenient);
});

test('explicit legacy encoding decoding is separate from format detection', () => {
  const result = decode(Uint8Array.of(0x80, 0x20, 0x41), { encoding: 'windows-1252' });
  assert.equal(result.text, '€ A');
  assert.equal(detectFormat(result.text).confidence, 'none');
});

test('decoder honors byte-view boundaries and reports unsupported labels', () => {
  const bytes = Uint8Array.of(0xff, 0x41, 0x42, 0xff);
  assert.equal(decode(bytes.subarray(1, 3)).text, 'AB');
  const result = decode(Uint8Array.of(0x41), { encoding: 'not-a-real-encoding' });
  assert.equal(result.text, null);
  hasIssue(result, 'fatal');
});

test('decoder enforces maxBytes before decoding', () => {
  const result = decode(Uint8Array.of(0x41, 0x42, 0x43), { maxBytes: 2 });
  assert.equal(result.text, null);
  hasIssue(result, 'fatal');
});

test('decoder rejects BOM conflict and unsupported UTF-32 explicitly', () => {
  for (const result of [decode(Uint8Array.of(0xff, 0xfe, 0x41, 0x00), { encoding: 'utf-8' }), decode(Uint8Array.of(0xff, 0xfe, 0, 0, 0x41, 0, 0, 0))]) {
    assert.equal(result.text, null);
    hasIssue(result, 'fatal');
  }
});

test('large SRT input has independently calculated count and endpoint', () => {
  // 20,000 distinct blocks, under six hours; generator uses integer arithmetic.
  const stamp = (ms) => `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
  const count = 20_000;
  const input = Array.from({ length: count }, (_, i) => `${i + 1}\n${stamp(i * 1000)} --> ${stamp(i * 1000 + 999)}\nline ${i}`).join('\n\n');
  const result = parse(input, { format: 'srt' });
  assert.equal(result.cues.length, count);
  assert.deepEqual([result.cues.at(-1).start, result.cues.at(-1).end, result.cues.at(-1).text], [19_999_000, 19_999_999, 'line 19999']);
});
