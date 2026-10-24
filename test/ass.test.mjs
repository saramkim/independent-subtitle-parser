import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../dist/index.js';

// Independent expectations derive from the public references, not parser output:
// https://github.com/libass/libass/wiki/ASS-File-Format-Guide (sections Events/Styles)
// https://aegisub.org/docs/latest/ass_tags/ (special characters, q, p, r)
// Durations below use integer arithmetic: ((h * 60 + m) * 60 + s) * 1000 + cc * 10.
const format = 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text';
const script = (...events) => ['[Script Info]', 'ScriptType: v4.00+', '[Events]', format, ...events].join('\n');
const dialogue = (text, start = '0:00:01.23', end = '0:00:04.56') => `Dialogue: 0,${start},${end},Default,배우,0,0,0,,${text}`;
const codes = result => result.diagnostics.map(diagnostic => diagnostic.code);

test('ASS centiseconds, embedded commas, multilingual payload and source fields', () => {
  const raw = String.raw`{\i1}안녕, العالم\N第二行\h🙂{\i0}`;
  const result = parse(script(dialogue(raw)), { format: 'ass' });
  assert.equal(result.status, 'ok');
  assert.equal(result.cues.length, 1);
  const cue = result.cues[0];
  assert.equal(cue.start, 1230);
  assert.equal(cue.end, 4560);
  assert.equal(cue.rawText, raw);
  assert.equal(cue.text, '안녕, العالم\n第二行\u00a0🙂');
  assert.deepEqual(cue.source, { line: 5, endLine: 5 });
  assert.deepEqual(cue.fields.find(field => field.name === 'Name'), { name: 'Name', value: '배우' });
  assert.ok(codes(result).includes('ASS_RENDERING_UNSUPPORTED'));
});

test('ASS honors dynamic field order and preserves duplicate non-timing fields', () => {
  const result = parse('[Events]\nFormat: End, Name, Start, Name, Text\nDialogue: 0:00:02.00,one,0:00:01.00,two,a,b,c', { format: 'ass' });
  assert.deepEqual(result.cues.map(({ start, end, text }) => ({ start, end, text })), [{ start: 1000, end: 2000, text: 'a,b,c' }]);
  assert.deepEqual(result.cues[0].fields.filter(field => field.name === 'Name').map(field => field.value), ['one', 'two']);
});

test('ASS hard/soft breaks obey script WrapStyle, q override and r reset', () => {
  const result = parse(['[Script Info]', 'WrapStyle: 2', '[Events]', format,
    dialogue(String.raw`a\nb{\q0}c\nd{\r}e\nf\Ng\hh`)].join('\n'), { format: 'ass' });
  assert.equal(result.cues[0].text, 'a\nbc de\nf\ng\u00a0h');
  assert.equal(parse(script(dialogue(String.raw`a\nb\Nc`)), { format: 'ass' }).cues[0].text, 'a b\nc');
});

test('ASS drawing instructions are not dialogue; drawing and overrides remain raw', () => {
  const raw = String.raw`before{\p1}m 0 0 l 10 10{\p0}after{\pbo10}ok{\p1}m 1 1{\r}end`;
  const result = parse(script(dialogue(raw)), { format: 'ass' });
  assert.equal(result.cues[0].text, 'beforeafterokend');
  assert.equal(result.cues[0].rawText, raw);
  const nested = parse(script(dialogue(String.raw`{\t(0,100,\p1)}visible`)), { format: 'ass' });
  assert.equal(nested.cues[0].text, 'visible');
});

test('ASS comments remain metadata and never become active cues', () => {
  const comment = 'Comment: 0,0:00:00.00,0:00:00.00,Default,,0,0,0,,editor note,with comma';
  const result = parse(script(comment, dialogue('visible')), { format: 'ass' });
  assert.equal(result.cues.length, 1);
  const metadata = result.metadata.find(block => block.kind === 'ass-comment');
  assert.equal(metadata.raw, comment);
  assert.equal(metadata.fields.at(-1).value, 'editor note,with comma');
});

test('SSA canonical Marked field and missing Format recovery are explicit', () => {
  const raw = '[Script Info]\nScriptType: v4.00\n[Events]\nDialogue: Marked=0,0:01:00.01,0:01:01.99,Default,,0,0,0,,SSA';
  const result = parse(raw, { format: 'ssa' });
  assert.equal(result.status, 'partial');
  assert.equal(result.cues[0].start, 60010);
  assert.equal(result.cues[0].end, 61990);
  assert.deepEqual(result.cues[0].fields[0], { name: 'Marked', value: 'Marked=0' });
  assert.ok(codes(result).includes('ASS_EVENT_FORMAT_ASSUMED'));
});

test('SSA legacy Timer is never silently applied or silently discarded', () => {
  // libass SSA-Version-History documents real legacy files using Timer != 100.
  // This library preserves literal event time rather than claiming playback scaling.
  for (const timer of ['50.0000', '200', '0', '-100', 'NaN', '', '100e0']) {
    const raw = ['[Script Info]', 'ScriptType: v4.00', `Timer: ${timer}`, '[Events]',
      'Format: Marked, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: Marked=0,0:00:02.00,0:00:04.00,Default,,0,0,0,,unchanged'].join('\n');
    const result = parse(raw, { format: 'ssa' });
    assert.equal(result.status, 'partial');
    assert.equal(result.cues[0].start, 2000);
    assert.equal(result.cues[0].end, 4000);
    assert.ok(codes(result).includes('ASS_TIMER_UNAPPLIED'));
    assert.ok(result.metadata.some(block => block.raw === `Timer: ${timer}`));
  }
  for (const timer of ['100', '100.0000']) {
    const raw = ['[Script Info]', 'ScriptType: v4.00+', `Timer: ${timer}`, '[Events]', format, dialogue('unchanged')].join('\n');
    const result = parse(raw, { format: 'ass' });
    assert.equal(result.status, 'ok');
    assert.ok(!codes(result).includes('ASS_TIMER_UNAPPLIED'));
  }
});

test('ASS/SSA selected-format conflict with ScriptType is diagnosed without rewriting times', () => {
  for (const [selected, declared, firstName, firstValue] of [
    ['ass', 'v4.00', 'Marked', 'Marked=0'], ['ssa', 'v4.00+', 'Layer', '0'],
  ]) {
    const raw = ['[Script Info]', `ScriptType: ${declared}`, '[Events]',
      `Dialogue: ${firstValue},0:00:01.00,0:00:02.00,Default,,0,0,0,,payload`].join('\n');
    const result = parse(raw, { format: selected });
    assert.equal(result.format, selected);
    assert.equal(result.cues[0].fields[0].name, firstName);
    assert.equal(result.cues[0].start, 1000);
    assert.equal(result.cues[0].end, 2000);
    assert.ok(codes(result).includes('ASS_SCRIPT_TYPE_MISMATCH'));
  }
});

test('ASS preserves script headers, style fields and opaque font/extension sections', () => {
  const raw = ['[Script Info]', 'Title: Title: subtitle', 'Title: Second', '[V4+ Styles]',
    'Format: Name, Fontname, __proto__', 'Style: Default,Noto Sans,retained',
    '[Fonts]', 'fontname: example.ttf', '!!encoded-data!!', '[Editor Extension]', 'custom: value', '[Events]', format, dialogue('x')].join('\n');
  const result = parse(raw, { format: 'ass' });
  assert.deepEqual(result.metadata.filter(block => block.kind === 'ass-script-info').map(block => block.fields[0].value), ['Title: subtitle', 'Second']);
  assert.deepEqual(result.metadata.find(block => block.kind === 'ass-style').fields[2], { name: '__proto__', value: 'retained' });
  assert.ok(result.metadata.some(block => block.raw === '!!encoded-data!!'));
  assert.ok(result.metadata.some(block => block.raw === 'custom: value'));
  assert.equal({}.retained, undefined);
});

test('ASS rejects malformed/unsafe time without manufacturing a cue and recovers later', () => {
  const bad = ['0:00:01.234', '-1:00:01.00', '0:61:00.00', '0:00:61.00', '999999999999999999999:00:00.00'];
  const result = parse(script(...bad.map(time => dialogue('bad', time, '0:00:10.00')), dialogue('good')), { format: 'ass' });
  assert.equal(result.cues.length, 1);
  assert.equal(result.cues[0].text, 'good');
  assert.equal(result.diagnostics.filter(diagnostic => diagnostic.code === 'ASS_INVALID_TIME').length, bad.length);
  assert.equal(result.metadata.filter(block => block.kind === 'ass-rejected-event').length, bad.length);
});

test('ASS accepts guide-permitted component 60 with visible normalization diagnostic', () => {
  const result = parse(script(dialogue('clock edge', '0:00:60.00', '0:01:01.00')), { format: 'ass' });
  assert.equal(result.cues[0].start, 60000);
  assert.equal(result.cues[0].end, 61000);
  assert.equal(result.cues[0].fields.find(field => field.name === 'Start').value, '0:00:60.00');
  assert.ok(codes(result).includes('ASS_TIME_NORMALIZED'));
});

test('ASS rejects nonfinal Text and duplicate timing columns, then recovers on a new Format', () => {
  const raw = ['[Events]', 'Format: Start, Text, End', 'Dialogue: 0:00:01.00,ambiguous,0:00:02.00',
    'Format: Start, End, Start, Text', 'Dialogue: 0:00:01.00,0:00:02.00,0:00:03.00,ambiguous',
    format, dialogue('good')].join('\n');
  const result = parse(raw, { format: 'ass' });
  assert.deepEqual(result.cues.map(cue => cue.text), ['good']);
  assert.equal(result.diagnostics.filter(diagnostic => diagnostic.code === 'ASS_EVENT_FORMAT').length, 2);
  assert.equal(result.metadata.filter(block => block.kind === 'ass-rejected-event').length, 2);
});

test('ASS unknown ScriptType requires explicit field mapping instead of guessing', () => {
  const result = parse(['[Script Info]', 'ScriptType: v4.00++', '[Events]', dialogue('unknown'), format, dialogue('mapped')].join('\n'), { format: 'ass' });
  assert.deepEqual(result.cues.map(cue => cue.text), ['mapped']);
  assert.ok(codes(result).includes('ASS_SCRIPT_VERSION'));
  assert.ok(codes(result).includes('ASS_EVENT_SKIPPED'));
});

test('ASS bad counts, zero/reverse duration and out-of-section events are not active', () => {
  const result = parse([dialogue('outside'), '[Events]', format, 'Dialogue: 0,too,few',
    dialogue('zero', '0:00:01.00', '0:00:01.00'), dialogue('reverse', '0:00:02.00', '0:00:01.00'), dialogue('good')].join('\n'), { format: 'ass' });
  assert.deepEqual(result.cues.map(cue => cue.text), ['good']);
  for (const code of ['ASS_EVENT_OUTSIDE_SECTION', 'ASS_EVENT_FIELD_COUNT', 'INVALID_INTERVAL']) assert.ok(codes(result).includes(code));
});

test('ASS keeps unclosed override literals with one diagnostic for a large damaged line', () => {
  const raw = 'visible' + '{'.repeat(100000);
  const result = parse(script(dialogue(raw)), { format: 'ass' });
  assert.equal(result.cues[0].text, raw);
  assert.equal(result.cues[0].rawText, raw);
  assert.equal(result.diagnostics.filter(diagnostic => diagnostic.code === 'ASS_UNCLOSED_OVERRIDE').length, 1);
});

test('ASS keeps input event order, overlaps, duplicates and meaningful payload whitespace', () => {
  const result = parse(script(dialogue('  later  ', '0:00:03.00', '0:00:05.00'), dialogue('earlier', '0:00:01.00', '0:00:04.00'), dialogue('earlier', '0:00:01.00', '0:00:04.00')), { format: 'ass' });
  assert.deepEqual(result.cues.map(cue => cue.start), [3000, 1000, 1000]);
  assert.equal(result.cues[0].text, '  later  ');
});

test('ASS large input count and first/last times use independently computed expectations', () => {
  const count = 10000;
  const events = Array.from({ length: count }, (_, index) => {
    const stamp = seconds => `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}.00`;
    return dialogue(`line ${index}`, stamp(index), stamp(index + 1));
  });
  const result = parse(script(...events), { format: 'ass' });
  assert.equal(result.cues.length, count);
  assert.equal(result.cues[0].start, 0);
  assert.equal(result.cues.at(-1).end, count * 1000);
});

test('ASS huge invalid Format does not trigger repeated full-header scans for every short event', () => {
  const raw = `[Events]\nFormat: ${Array(20000).fill('Unknown').join(',')},Text\n${Array(2000).fill('Dialogue: short').join('\n')}`;
  const result = parse(raw, { format: 'ass' });
  assert.equal(result.cues.length, 0);
  assert.ok(codes(result).includes('ASS_EVENT_FORMAT'));
});
