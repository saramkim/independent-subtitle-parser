import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { parse, decode, detectFormat, DEFAULT_LIMITS } from '../dist/index.js';

test('API misuse throws separately from malformed content diagnostics', () => {
  assert.throws(() => parse(new Uint8Array()), TypeError);
  assert.throws(() => parse('', { format: 'xml' }), TypeError);
  for (const value of [0, -1, NaN, Infinity, 1.5]) assert.throws(() => parse('', { limits: { maxCues: value } }), RangeError);
  assert.throws(() => decode('text'), TypeError);
  assert.ok(Object.isFrozen(DEFAULT_LIMITS));
});

test('SRT timing recovery and source order retain duplicate IDs and no-separator cues', () => {
  const result = parse('1\n00:00:02,000 --> 00:00:03,000\nB\n1\n00:00:01,000 --> 00:00:02,000\nA');
  assert.deepEqual(result.cues.map(c => [c.id, c.start, c.text]), [['1', 2000, 'B'], ['1', 1000, 'A']]);
  assert.ok(result.diagnostics.some(d => d.code === 'MISSING_SEPARATOR'));
  assert.ok(result.diagnostics.some(d => d.code === 'CUE_ORDER'));
});

test('SRT quoted greater-than inside font attributes is not a text delimiter', () => {
  const raw = '<font title="a > b" color="red">hello</font> 2 < 3';
  const result = parse(`1\n00:00:01,000 --> 00:00:02,000\n${raw}`);
  assert.equal(result.cues[0].text, 'hello 2 < 3');
  assert.equal(result.cues[0].rawText, raw);
});

test('HTML text references decode once with longest match and Unicode replacement rules', () => {
  const result = parse('1\n00:00:00,000 --> 00:00:01,000\n&notin; &notit; &#x80; &#0; &#xD800; &#x110000; &amp;lt; &eacute; &NotEqualTilde;');
  assert.equal(result.cues[0].text, '∉ ¬it; € � � � &lt; é ≂̸');
  assert.ok(result.diagnostics.some(d => d.code === 'ENTITY_RECOVERY'));
});

test('WebVTT local timestamp map, invalid settings and inline time errors are disclosed', () => {
  const source = 'WEBVTT\nX-TIMESTAMP-MAP=LOCAL:00:00:00.000,MPEGTS:900000\n\n00:01.000 --> 00:02.000 align:start align:end size:101%\nA<00:00.500>B<00:03.000>C';
  const result = parse(source);
  assert.equal(result.cues[0].start, 1000);
  assert.equal(result.cues[0].text, 'ABC');
  for (const code of ['VTT_TIMESTAMP_MAP_UNAPPLIED', 'VTT_SETTING_DUPLICATE', 'VTT_SETTING_UNSUPPORTED', 'VTT_TIMESTAMP_ORDER']) assert.ok(result.diagnostics.some(d => d.code === code), code);
});

test('NUL recovery preserves exact original source while VTT reading text follows spec', () => {
  const source = 'WEBVTT\n\n00:00.000 --> 00:01.000\na\0b';
  const result = parse(source);
  assert.equal(result.cues[0].text, 'a�b');
  assert.equal(result.sourceText, source);
  assert.equal(result.status, 'partial');
});

test('decode UTF-32, explicit BOM conflict, EUC-KR and exact subarray boundaries', () => {
  assert.equal(decode(Uint8Array.of(0xff, 0xfe, 0, 0, 65, 0, 0, 0)).text, null);
  assert.equal(decode(Uint8Array.of(0xff, 0xfe, 65, 0), { encoding: 'utf-8' }).text, null);
  assert.equal(decode(Uint8Array.of(0xb0, 0xa1), { encoding: 'euc-kr' }).text, '가');
  assert.equal(decode(Uint8Array.of(0xb0, 0xa1)).text, null);
  assert.equal(decode(Uint8Array.of(0xff, 0xfe, 65, 0).subarray(2)).text, 'A\0');
});

test('deterministic damaged-input fuzz preserves finite interval invariants without throwing', () => {
  let state = 1234567;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state; };
  const samples = [
    '1\n00:00:00,000 --> 00:00:01,000\nHello <b>가</b>',
    'WEBVTT\n\n00:00.000 --> 00:01.000\nمرحبا',
    '<SAMI><SYNC Start=0><P Class=ko>가<SYNC Start=100><P Class=ko>&nbsp;</SAMI>',
    '[Script Info]\n[Events]\nFormat: Start, End, Text\nDialogue: 0:00:00.00,0:00:01.00,{\\b1}x',
  ];
  const formats = ['srt', 'vtt', 'sami', 'ass'];
  const chars = '\0<>"\'&{}:,.0129\n\r한';
  for (let i = 0; i < 400; i++) {
    const n = i % samples.length;
    let input = samples[n];
    for (let j = 0; j < 6; j++) {
      const at = random() % (input.length + 1);
      input = input.slice(0, at) + chars[random() % chars.length] + input.slice(at + random() % 2);
    }
    const result = parse(input, { format: formats[n], limits: { maxDiagnostics: 10 } });
    assert.equal(result.sourceText, input);
    assert.ok(result.diagnostics.length <= 10);
    for (const cue of result.cues) {
      assert.ok(Number.isSafeInteger(cue.start) && cue.start >= 0);
      assert.ok(cue.end === null || Number.isSafeInteger(cue.end) && cue.end > cue.start);
      assert.ok(result.tracks.some(track => track.id === cue.trackId));
    }
  }
});

test('hostile long markup, names and class lists terminate within an isolated budget', () => {
  const script = `import { parse } from './dist/index.js';
  for (const text of ['<'.repeat(200000), '<b'+'.a'.repeat(80000)+'!>', '&'+'z'.repeat(200000)+';', '<font title="'+'x'.repeat(200000)]) {
    const r=parse('WEBVTT\\n\\n00:00.000 --> 00:01.000\\n'+text); if(r.cues.length!==1) throw Error('lost cue');
  }`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: new URL('..', import.meta.url), timeout: 5000, encoding: 'utf8' });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});

test('empty and ambiguous sources return explicit outcomes', () => {
  assert.equal(parse('').status, 'fatal');
  assert.equal(parse('WEBVTT').status, 'ok');
  assert.equal(parse('WEBVTT').cues.length, 0);
  assert.equal(detectFormat('00:00:01.000 --> 00:00:02.000\nA').confidence, 'ambiguous');
});

test('WebVTT STYLE and REGION block labels accept trailing ASCII whitespace', () => {
  const result = parse('WEBVTT\n\nSTYLE \t\n::cue { color: lime; }\n\nREGION\t\nid:r\n\n00:00.000 --> 00:01.000\nA');
  assert.ok(result.metadata.some(m => m.kind === 'vtt-style' && m.raw.includes('lime')));
  assert.ok(result.metadata.some(m => m.kind === 'vtt-region'));
  assert.equal(result.cues[0].text, 'A');
  assert.equal(result.status, 'ok');
});

test('WebVTT timing on the second line takes precedence over STYLE/REGION identifiers', () => {
  for (const id of ['STYLE', 'REGION', 'NOTE']) {
    const result = parse(`WEBVTT\n\n${id}\n00:00.000 --> 00:01.000\nA`);
    assert.deepEqual(result.cues.map(c => [c.id, c.text]), [[id, 'A']]);
  }
});

test('newline-only detection is bounded and explicit parsing bypasses heuristic detection', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `import { detectFormat, parse } from './dist/index.js';
    for (let i=0;i<20;i++) if(detectFormat('\\n'.repeat(65536)).confidence!=='none') throw Error('detection');
    if(parse('WEBVTT', {format:'vtt'}).status!=='ok') throw Error('explicit');`],
    { cwd: new URL('..', import.meta.url), timeout: 5000, encoding: 'utf8' });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});
