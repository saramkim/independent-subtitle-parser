import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, detectFormat } from '../dist/index.js';

const options = { format: 'vtt', recoverMissingVttHeader: true };
const body = '00:01.000 --> 00:02.000\nHello';

test('header recovery requires both explicit VTT and the opt-in flag', () => {
  for (const opts of [{ format: 'vtt' }, { format: 'vtt', recoverMissingVttHeader: false }]) {
    const result = parse(body, opts);
    assert.equal(result.status, 'fatal');
    assert.equal(result.diagnostics[0].code, 'VTT_SIGNATURE');
  }
  const detection = detectFormat(body);
  assert.deepEqual(parse(body, { recoverMissingVttHeader: true }), parse(body));
  assert.deepEqual(detectFormat(body), detection);
  assert.deepEqual(parse(body, { format: 'srt', recoverMissingVttHeader: true }), parse(body, { format: 'srt' }));
  const normal = 'WEBVTT\n\n' + body;
  assert.deepEqual(parse(normal, options), parse(normal, { format: 'vtt' }));
  assert.deepEqual(parse(normal, { recoverMissingVttHeader: true }), parse(normal));
  for (const value of ['true', 1, null, {}]) {
    assert.throws(() => parse(body, { ...options, recoverMissingVttHeader: value }), TypeError);
  }
});

test('recovery preserves exact source, IDs, settings, metadata and all source lines', () => {
  for (const newline of ['\n', '\r\n', '\r']) {
    const source = '\uFEFF' + ['', 'NOTE source', 'note', '', 'cue-id',
      '00:01.000 --> 00:02.000 align:start', '<b>Hello</b>', 'world', '',
      '00:03.000 --> 00:04.000 bad:setting', 'Next'].join(newline);
    const result = parse(source, options);
    assert.equal(result.status, 'partial');
    assert.equal(result.sourceText, source);
    assert.equal(result.cues.length, 2);
    assert.equal(result.cues[0].id, 'cue-id');
    assert.equal(result.cues[0].settings, 'align:start');
    assert.equal(result.cues[0].rawText, '<b>Hello</b>\nworld');
    assert.deepEqual(result.cues.map(cue => cue.source), [{ line: 5, endLine: 8 }, { line: 10, endLine: 11 }]);
    assert.deepEqual(result.metadata, [{ kind: 'vtt-note', raw: 'NOTE source\nnote', source: { line: 2, endLine: 3 } }]);
    assert.deepEqual(result.diagnostics.map(({code, severity, line}) => ({code, severity, line})), [
      { code: 'VTT_HEADER_RECOVERED', severity: 'warning', line: 1 },
      { code: 'MARKUP_PRESERVED', severity: 'info', line: 7 },
      { code: 'VTT_SETTING_UNSUPPORTED', severity: 'warning', line: 10 },
    ]);
  }
});

test('existing timing recovery and invalid-cue diagnostics keep original positions', () => {
  const source = '00:01.000-->00:02.000\nOne\n\n00:04.000 --> 00:03.000\nBad\n\n00:05.000 --> 00:06.000\nTwo';
  const result = parse(source, options);
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.cues.map(cue => cue.start), [1000, 5000]);
  assert.equal(result.diagnostics.find(d => d.code === 'VTT_TIMING_RECOVERED').line, 1);
  assert.equal(result.diagnostics.find(d => d.code === 'INVALID_INTERVAL').line, 4);
  assert.equal(result.diagnostics.filter(d => d.code === 'VTT_HEADER_RECOVERED').length, 1);
});

test('recognized layout blocks and empty cue payloads use the existing body rules', () => {
  const result = parse('STYLE\n::cue { color: red }\n\nREGION\nid:r\n\n00:01.000 --> 00:02.000', options);
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.metadata.map(block => [block.kind, block.source]), [
    ['vtt-style', { line: 1, endLine: 2 }], ['vtt-region', { line: 4, endLine: 5 }],
  ]);
  assert.equal(result.cues.length, 1);
  assert.equal(result.cues[0].rawText, '');
  assert.equal(result.diagnostics.find(d => d.code === 'EMPTY_CUE').line, 7);
});

test('missing-header recovery rejects unusable input, damaged signatures and preambles', () => {
  for (const source of ['', 'NOTE only\ntext', 'STYLE\n::cue { color: red }',
    '00:99.000 --> 00:100.000\nBad', '00:02.000 --> 00:01.000\nBad',
    '00:00:01,000 --> 00:00:02,000\nSRT',
    'WEBVTTbroken\n\n' + body, 'webvtt\n\n' + body,
    '\nWEBVTT\n\n' + body, 'unrelated preamble\n\n' + body]) {
    const result = parse(source, options);
    assert.equal(result.status, 'fatal', source);
    assert.equal(result.sourceText, source);
    assert.equal(result.diagnostics.at(-1).code, 'VTT_SIGNATURE');
    assert.deepEqual([result.cues, result.tracks, result.metadata], [[], [], []]);
  }
});

test('recovery respects budgets and diagnostic truncation', () => {
  const limited = parse(body, { ...options, limits: { maxLines: 1 } });
  assert.equal(limited.status, 'fatal');
  assert.equal(limited.diagnostics[0].code, 'LINE_LIMIT');
  const cues = parse(body + '\n\n' + body, { ...options, limits: { maxCues: 1, maxDiagnostics: 1 } });
  assert.equal(cues.status, 'fatal');
  assert.equal(cues.diagnostics[0].code, 'CUE_LIMIT');
  assert.deepEqual(cues.cues, []);
  const truncated = parse(body + '\n\nbroken', { ...options, limits: { maxDiagnostics: 1 } });
  assert.equal(truncated.status, 'partial');
  assert.equal(truncated.diagnosticsTruncated, true);
  assert.equal(truncated.diagnostics[0].code, 'INVALID_TIMING');
  assert.equal(truncated.cues.length, 1);
});
