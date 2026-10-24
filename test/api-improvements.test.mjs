import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { decode, parse } from '../dist/index.js';

// Cross-realm typed-array expectations follow ECMAScript internal-slot branding:
// https://tc39.es/ecma262/#sec-get-%typedarray%.prototype-%symbol.tostringtag%
// https://tc39.es/ecma262/#sec-arraybuffer.isview
test('decode accepts genuine cross-realm Uint8Array and honors its view boundaries', () => {
  const bytes = vm.runInNewContext('new Uint8Array([255, 72, 105, 255]).subarray(1, 3)');
  assert.equal(bytes instanceof Uint8Array, false);
  assert.equal(decode(bytes).text, 'Hi');
  assert.equal(decode(bytes, { maxBytes: 1 }).diagnostics[0].code, 'BYTE_LIMIT');
  assert.equal(decode(bytes, { maxBytes: 2 }).text, 'Hi');
});

test('decode keeps Buffer and local Uint8Array subarray behavior', () => {
  const buffer = Buffer.from([255, 79, 75, 255]).subarray(1, 3);
  const view = new Uint8Array([255, 79, 75, 255]).subarray(1, 3);
  for (const bytes of [buffer, view]) {
    assert.equal(decode(bytes).text, 'OK');
    assert.equal(decode(bytes, { maxBytes: 1 }).diagnostics[0].code, 'BYTE_LIMIT');
  }
});

test('decode rejects spoofed branding, other view types and typed-array proxies', () => {
  const spoofedView = new Int8Array([72, 105]);
  Object.defineProperty(spoofedView, Symbol.toStringTag, { value: 'Uint8Array' });
  for (const value of [
    { 0: 72, 1: 105, length: 2, byteLength: 2, [Symbol.toStringTag]: 'Uint8Array' },
    Object.create(Uint8Array.prototype), spoofedView,
    new Uint8ClampedArray([72, 105]), new DataView(new ArrayBuffer(2)),
    new Int8Array([72, 105]), new Uint16Array([72, 105]),
    new Proxy(new Uint8Array([72, 105]), {}),
  ]) assert.throws(() => decode(value), TypeError);
});

test('decode checks actual typed-array slots despite own tag and byteLength properties', () => {
  const bytes = new Uint8Array([72, 105]);
  Object.defineProperty(bytes, Symbol.toStringTag, { value: 'NotAByteArray' });
  Object.defineProperty(bytes, 'byteLength', { value: 0 });
  assert.equal(decode(bytes).text, 'Hi');
  assert.equal(decode(bytes, { maxBytes: 1 }).diagnostics[0].code, 'BYTE_LIMIT');
});

const ass = (...events) => ['[Events]', 'Format: Start, End, Text', ...events].join('\n');

test('a one-diagnostic budget retains the actual error over initial projection info', () => {
  const result = parse(ass('Dialogue: bad,0:00:02.00,lost'), { format: 'ass', limits: { maxDiagnostics: 1 } });
  assert.equal(result.status, 'partial');
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code, 'ASS_INVALID_TIME');
  assert.equal(result.diagnostics[0].severity, 'error');
  assert.equal(result.diagnosticsTruncated, true);
});

test('a one-diagnostic budget retains a warning over info and preserves cue timing', () => {
  const source = '[Script Info]\nTimer: 50\n' + ass('Dialogue: 0:00:01.00,0:00:02.00,kept');
  const result = parse(source, { format: 'ass', limits: { maxDiagnostics: 1 } });
  assert.equal(result.diagnostics[0].code, 'ASS_TIMER_UNAPPLIED');
  assert.equal(result.diagnostics[0].severity, 'warning');
  assert.equal(result.diagnosticsTruncated, true);
  assert.equal(result.cues[0].start, 1000);
});

test('retained diagnostics stay in encounter order and ties retain earlier errors', () => {
  const mixed = parse(ass('Dialogue: bad,0:00:02.00,first') + '\n[Script Info]\nTimer: 50',
    { format: 'ass', limits: { maxDiagnostics: 2 } });
  assert.deepEqual(mixed.diagnostics.map(diagnostic => diagnostic.code), ['ASS_INVALID_TIME', 'ASS_TIMER_UNAPPLIED']);
  const source = '[Script Info]\nTimer: 50\n' + ass(
    'Dialogue: first-bad,0:00:02.00,first', 'Dialogue: second-bad,0:00:02.00,second',
  );
  const result = parse(source, { format: 'ass', limits: { maxDiagnostics: 2 } });
  assert.deepEqual(result.diagnostics.map(({ code, line }) => ({ code, line })), [
    { code: 'ASS_INVALID_TIME', line: 5 }, { code: 'ASS_INVALID_TIME', line: 6 },
  ]);
  const single = parse(source, { format: 'ass', limits: { maxDiagnostics: 1 } });
  assert.equal(single.diagnostics[0].line, 5);
  assert.equal(single.diagnosticsTruncated, true);
});

test('fatal cause survives a full budget without increasing the diagnostic array', () => {
  const result = parse(ass(
    'Dialogue: invalid,0:00:01.00,bad',
    'Dialogue: 0:00:01.00,0:00:02.00,one',
    'Dialogue: 0:00:02.00,0:00:03.00,two',
  ), { format: 'ass', limits: { maxCues: 1, maxDiagnostics: 1 } });
  assert.equal(result.status, 'fatal');
  assert.deepEqual(result.cues, []);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code, 'CUE_LIMIT');
  assert.equal(result.diagnostics[0].severity, 'fatal');
  assert.equal(result.diagnosticsTruncated, true);
});

test('only-info budget exhaustion is explicit and keeps the prior partial-result policy', () => {
  const source = 'WEBVTT\n\nSTYLE\n::cue { color: red }\n\n00:00.000 --> 00:01.000\n<b>x</b>';
  const result = parse(source, { limits: { maxDiagnostics: 1 } });
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].severity, 'info');
  assert.equal(result.diagnosticsTruncated, true);
  assert.equal(result.status, 'partial');
});

test('info coalescing is distinct from truncation, and ordinary/failure results expose false', () => {
  const source = Array.from({ length: 10 }, (_, index) => `${index + 1}\n00:00:00,000 --> 00:00:01,000\n<b>x</b>`).join('\n\n');
  const result = parse(source, { limits: { maxDiagnostics: 1 } });
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code, 'MARKUP_PRESERVED');
  assert.equal(result.diagnosticsTruncated, false);
  assert.equal(result.status, 'ok');
  assert.equal(parse('WEBVTT').diagnosticsTruncated, false);
  assert.equal(parse('not a recognized subtitle').diagnosticsTruncated, false);
  assert.equal(parse('WEBVTT', { limits: { maxInputLength: 1 } }).diagnosticsTruncated, false);
});

test('many discarded errors keep diagnostics bounded and preserve earliest actionable locations', () => {
  const source = ass(...Array.from({ length: 10000 }, (_, index) => `Dialogue: bad-${index},0:00:02.00,x`));
  const result = parse(source, { format: 'ass', limits: { maxDiagnostics: 1000 } });
  assert.equal(result.diagnostics.length, 1000);
  assert.ok(result.diagnostics.every(diagnostic => diagnostic.code === 'ASS_INVALID_TIME'));
  assert.equal(result.diagnostics[0].line, 3);
  assert.equal(result.diagnostics.at(-1).line, 1002);
  assert.equal(result.diagnosticsTruncated, true);
});
