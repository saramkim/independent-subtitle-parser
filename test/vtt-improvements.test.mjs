import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { parse } from '../dist/index.js';

// New expectations fixed before the phase-two runtime changes. These fixtures
// are authored here, not copied from an existing parser or product test suite.
// W3C WebVTT CRD 2026-05-20 sections 4.1, 4.4, and 6.3 distinguish authoring
// syntax from browser parsing/recovery:
// https://www.w3.org/TR/2026/CRD-webvtt1-20260520/
// ASCII whitespace (not JavaScript \s): https://infra.spec.whatwg.org/#ascii-whitespace
// This package's extra policy is to warn when recovering non-authoring syntax,
// retain exact source and cue data, and diagnose duplicate IDs without rewriting.
const issues = (result) => result.diagnostics.filter((d) => d.severity !== 'info');
const warning = (result) => assert.ok(result.diagnostics.some((d) => d.severity === 'warning'),
  `expected warning: ${JSON.stringify(result.diagnostics)}`);
const oneCue = (timing, payload = '한글\nSecond line') => `WEBVTT\n\n${timing}\n${payload}`;

test('VTT strict valid timing/settings remain clean, including long hours and tabs', () => {
  const input = oneCue('100:02:03.004\t-->\t100:02:04.005 line:-1,end position:25.5%,line-left size:90% align:start vertical:rl');
  const result = parse(input);
  assert.equal(result.status, 'ok');
  assert.deepEqual(issues(result), []);
  assert.deepEqual(result.cues.map((c) => [c.start, c.end]), [[360123004, 360124005]]);
  assert.equal(result.cues[0].text, '한글\nSecond line');
  assert.equal(result.sourceText, input);
});

for (const [name, timing, expected] of [
  ['no spaces around arrow', '00:01.000-->00:02.000', [1000, 2000]],
  ['no space before arrow', '00:01.000--> 00:02.000', [1000, 2000]],
  ['no space after arrow', '00:01.000 -->00:02.000', [1000, 2000]],
  ['single hour digit', '1:00:00.000 --> 1:00:01.000', [3600000, 3601000]],
  ['single zero hour digit', '0:02:03.004 --> 0:02:04.005', [123004, 124005]],
  ['form feed around arrow', '00:01.000\f-->\f00:02.000', [1000, 2000]],
]) {
  test(`VTT recovery: ${name} retains precise times and discloses recovery`, () => {
    const input = oneCue(timing).replaceAll('\n', '\r\n');
    const result = parse(input);
    assert.deepEqual(result.cues.map((c) => [c.start, c.end]), [expected]);
    assert.equal(result.cues[0].rawText, '한글\nSecond line');
    assert.equal(result.cues[0].text, '한글\nSecond line');
    assert.deepEqual(result.cues[0].source, { line: 3, endLine: 5 });
    assert.equal(result.sourceText, input);
    assert.equal(result.status, 'partial');
    warning(result);
    assert.ok(!result.diagnostics.some((d) => d.severity === 'error' || d.severity === 'fatal'));
  });
}

test('VTT missing delimiter before settings recovers the cue and preserves the setting', () => {
  const input = oneCue('00:01.000 --> 00:02.000align:start');
  const result = parse(input);
  assert.deepEqual(result.cues.map((c) => [c.start, c.end, c.settings]), [[1000, 2000, 'align:start']]);
  assert.equal(result.sourceText, input);
  assert.equal(result.status, 'partial');
  warning(result);
});

test('VTT FF separates otherwise valid settings but receives an authoring warning', () => {
  const input = oneCue('00:01.000 --> 00:02.000 line:0\falign:start');
  const result = parse(input);
  assert.equal(result.cues.length, 1);
  assert.equal(result.cues[0].settings, 'line:0\falign:start');
  assert.equal(result.sourceText, input);
  assert.equal(result.status, 'partial');
  warning(result);
  assert.ok(!result.diagnostics.some((d) => d.code === 'VTT_SETTING_UNSUPPORTED'));
});

test('VTT compact recovered timing also resynchronizes a missing blank separator', () => {
  const input = 'WEBVTT\n\n00:01.000 --> 00:02.000\nfirst\n00:03.000-->00:04.000\nsecond';
  const result = parse(input);
  assert.deepEqual(result.cues.map((c) => [c.start, c.end, c.text]), [[1000, 2000, 'first'], [3000, 4000, 'second']]);
  assert.deepEqual(result.cues.map((c) => c.source), [{ line: 3, endLine: 4 }, { line: 5, endLine: 6 }]);
  assert.equal(result.sourceText, input);
  assert.equal(result.status, 'partial');
  warning(result);
});

for (const [name, timing] of [
  ['short minute field without hour component', '1:02.000 --> 00:03.000'],
  ['minute component over 59', '60:00.000 --> 60:01.000'],
  ['second component over 59', '00:60.000 --> 01:01.000'],
  ['two-digit start fraction', '00:01.00 --> 00:02.000'],
  ['four-digit start fraction', '00:01.0000 --> 00:02.000'],
  ['four-digit end fraction', '00:01.000 --> 00:02.0000'],
  ['non-breaking space before arrow', '00:01.000\u00a0--> 00:02.000'],
  ['vertical tab after arrow', '00:01.000 -->\u000b00:02.000'],
  ['incorrect arrow', '00:01.000 -> 00:02.000'],
  ['garbage before arrow', '00:01.000x --> 00:02.000'],
]) {
  test(`VTT recovery stays bounded: rejects ${name} and retains later valid cue`, () => {
    const input = `${oneCue(timing, 'bad')}\n\n00:03.000 --> 00:04.000\nvalid`;
    const result = parse(input);
    assert.deepEqual(result.cues.map((c) => [c.start, c.end, c.text]), [[3000, 4000, 'valid']]);
    assert.equal(result.sourceText, input);
    assert.equal(result.status, 'partial');
    assert.ok(result.diagnostics.some((d) => d.severity === 'error'));
  });
}

test('VTT line:auto is not a serialized cue setting even though it is an API default', () => {
  const input = oneCue('00:01.000 --> 00:02.000 line:auto');
  const result = parse(input);
  assert.equal(result.cues.length, 1);
  assert.equal(result.cues[0].settings, 'line:auto');
  assert.equal(result.sourceText, input);
  assert.equal(result.status, 'partial');
  warning(result);
});

test('VTT duplicate identifiers are disclosed without removing or changing cues', () => {
  const input = 'WEBVTT\n\nsame\n00:01.000 --> 00:02.000\nA\n\nsame\n00:03.000 --> 00:04.000\nB\n\nSAME\n00:05.000 --> 00:06.000\nC';
  const result = parse(input);
  assert.deepEqual(result.cues.map((c) => [c.id, c.start, c.end, c.text]), [
    ['same', 1000, 2000, 'A'], ['same', 3000, 4000, 'B'], ['SAME', 5000, 6000, 'C'],
  ]);
  assert.equal(result.sourceText, input);
  assert.equal(result.status, 'partial');
  warning(result);
  assert.ok(result.diagnostics.some((d) => d.severity === 'warning' && d.line === 7));
});

test('VTT identifier identity is case-sensitive, Unicode-sensitive, and ordinary string data', () => {
  const ids = ['same', 'SAME', 'é', 'e\u0301', '__proto__', 'constructor'];
  const input = `WEBVTT\n\n${ids.map((id, i) => `${id}\n00:0${i}.000 --> 00:0${i + 1}.000\n${i}`).join('\n\n')}`;
  const result = parse(input);
  assert.deepEqual(result.cues.map((c) => c.id), ids);
  assert.equal(result.status, 'ok');
  assert.deepEqual(issues(result), []);
});

test('VTT recovery does not silently widen SRT timing syntax', () => {
  const result = parse('1\n00:00:01,000-->00:00:02,000\nA', { format: 'srt' });
  assert.equal(result.cues.length, 0);
  assert.equal(result.status, 'partial');
});

for (const separator of ['\u2028', '\u2029']) {
  test(`VTT U+${separator.charCodeAt(0).toString(16).toUpperCase()} is not a WebVTT line terminator or ASCII setting separator`, () => {
    // Sections 4.1 and 4.3 permit these characters in a region identifier;
    // JavaScript's dot/whitespace character classes are not the format grammar.
    const setting = `region:a${separator}b`;
    const input = oneCue(`00:01.000 --> 00:02.000 ${setting}`, 'A');
    const result = parse(input);
    assert.deepEqual(result.cues.map((c) => [c.start, c.end, c.settings, c.text]), [[1000, 2000, setting, 'A']]);
    assert.equal(result.sourceText, input);
    assert.equal(result.status, 'ok');
  });
}

test('timing remainders with long spaces and Unicode separators avoid superlinear backtracking', () => {
  // A child timeout remains enforceable when synchronous regex work blocks.
  // The budget is an engineering regression check, not a speed or conformance claim.
  const entry = new URL('../dist/index.js', import.meta.url).href;
  const code = `import {parse} from ${JSON.stringify(entry)};
    for (const [format, prefix] of [['vtt', 'WEBVTT\\n\\n00:01.000 --> 00:02.000'], ['srt', '1\\n00:00:01,000 --> 00:00:02,000']]) {
      const input=prefix+' '.repeat(100000)+'\\u2028x\\nA';
      const result=parse(input,{format});
      if (result.cues.length!==1 || result.cues[0].text!=='A' || result.sourceText!==input) process.exit(2);
    }
    process.stdout.write('done');`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], { timeout: 5000, encoding: 'utf8' });
  assert.equal(child.error, undefined, String(child.error));
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, 'done');
});
