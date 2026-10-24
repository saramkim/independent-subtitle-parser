import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../dist/index.js';

// Independent extraction expectations:
// Aegisub, Override tags: an omitted parameter restores the default value.
// https://aegisub.org/docs/latest/ass_tags/#override-tags
// libass ass_parse.c corroborates bare p -> 0 and bare q -> track WrapStyle.
// https://github.com/libass/libass/blob/0.17.5/libass/ass_parse.c
// Escaped braces are expressly a libass extension, not universal ASS syntax:
// https://github.com/libass/libass/wiki/Libass%27-ASS-Extensions#literal-curly-brackets
const format = 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text';
const document = (text, wrap = 0, effect = '') => ['[Script Info]', 'ScriptType: v4.00+', `WrapStyle: ${wrap}`, '[Events]', format,
  `Dialogue: 0,0:00:01.25,0:00:03.75,Default,,0,0,0,${effect},${text}`].join('\n');
const read = (text, wrap = 0, effect = '') => parse(document(text, wrap, effect), { format: 'ass' });

test('ASS bare drawing tag restores text instead of swallowing later dialogue', () => {
  for (const reset of [String.raw`{\p}`, String.raw`{\p }`, String.raw`{\p\i1}`]) {
    const result = read(String.raw`before{\p1}m 0 0 l 10 10` + reset + String.raw`spoken\Nnext`);
    assert.equal(result.cues[0].text, 'beforespoken\nnext');
    assert.equal(result.cues[0].start, 1250);
    assert.equal(result.cues[0].end, 3750);
    assert.equal(result.status, 'ok');
  }
});

test('ASS bare wrap tag restores the script wrapping mode in both directions', () => {
  assert.equal(read(String.raw`{\q2}a\nb{\q}c\nd`).cues[0].text, 'a\nbc d');
  assert.equal(read(String.raw`{\q0}a\nb{\q }c\nd`, 2).cues[0].text, 'a bc\nd');
  assert.equal(read(String.raw`{\q2}a\nb{\q\i1}c\nd`, 1).cues[0].text, 'a\nbc d');
});

test('ASS Banner initializes mode 2 but bare q restores script WrapStyle', () => {
  // Banner implies q2 (libass authoring guide, Effects); q without a parameter
  // restores the script setting, rather than reapplying the event effect.
  const result = read(String.raw`a\nb{\q}c\nd`, 0, 'Banner;10;1');
  assert.equal(result.cues[0].text, 'a\nbc d');
  assert.equal(result.cues[0].fields.find(field => field.name === 'Effect').value, 'Banner;10;1');
});

test('ASS similar tag prefixes and nested transform tags are not bare p/q resets', () => {
  const raw = String.raw`{\p1}m 0 0{\pbo12\pos(1,2)\t(\p)}still drawing{\p}visible`;
  assert.equal(read(raw).cues[0].text, 'visible');
  assert.equal(read(String.raw`{\q2}a\nb{\t(\q)}c\nd`).cues[0].text, 'a\nbc\nd');
});

test('ASS libass escaped braces preserve meaningful literal content and provenance', () => {
  const raw = String.raw`before\{literal, 한국어 العربية 🙂\}after`;
  const source = document(raw);
  const result = parse(source, { format: 'ass' });
  assert.equal(result.cues[0].text, 'before{literal, 한국어 العربية 🙂}after');
  assert.equal(result.cues[0].rawText, raw);
  assert.equal(result.sourceText, source);
  const diagnostic = result.diagnostics.find(d => d.code === 'ASS_LIBASS_ESCAPED_BRACES');
  assert.equal(diagnostic.severity, 'info');
  assert.equal(diagnostic.line, 6);
  assert.equal(result.status, 'ok');
});

test('ASS escaped opening brace cannot introduce an override', () => {
  const result = read(String.raw`\{\p1\}visible{\i1}italic{comment}\}end`);
  assert.equal(result.cues[0].text, String.raw`{\p1}visibleitalic}end`);
});

test('ASS literal brace escapes compose with drawing mode and regular line escapes', () => {
  const raw = String.raw`{\p1}m 0 0\{ignored\}{\p}\{spoken\}\Nnext\hword`;
  assert.equal(read(raw).cues[0].text, '{spoken}\nnext\u00a0word');
});

test('ASS literal closing brace and unknown escapes do not erase ordinary text', () => {
  assert.equal(read(String.raw`a\}b\x\Ntail`).cues[0].text, 'a}b\\x\ntail');
  assert.equal(read(String.raw`a}b`).cues[0].text, 'a}b');
});

test('ASS large escape runs have independently counted text and bounded diagnostics', () => {
  const count = 30000;
  const result = read(String.raw`\{x\}`.repeat(count));
  assert.equal(result.cues[0].text, '{x}'.repeat(count));
  assert.equal(result.diagnostics.filter(d => d.code === 'ASS_LIBASS_ESCAPED_BRACES').length, 1);
});

test('ASS plain-text fast path preserves exact payload including whitespace and Unicode', () => {
  const raw = '  literal }\tالعربية 한국어 e\u0301 🙂\u00a0 ';
  const result = read(raw);
  assert.equal(result.cues[0].text, raw);
  assert.equal(result.cues[0].rawText, raw);
  assert.ok(!result.diagnostics.some(d => d.code === 'ASS_LIBASS_ESCAPED_BRACES'));
});

test('ASS r reset warns when its existing extraction policy changes wrap or drawing', () => {
  // Preserve this library's existing profile, without claiming renderer parity:
  // libass 0.17.5 ass_render.c ass_reset_render_context does not reset these
  // two fields, despite the broader reset description in Aegisub's tag guide.
  const cases = [
    [String.raw`{\q2}a\nb{\r}c\nd`, 'a\nbc d'],
    [String.raw`{\p1}m 0 0{\r}spoken`, 'spoken'],
    [String.raw`{\q2\p1}m 0 0{\rAlternate}spoken\nnext`, 'spoken next'],
  ];
  for (const [raw, expected] of cases) {
    const result = read(raw);
    assert.equal(result.cues[0].text, expected);
    assert.equal(result.cues[0].rawText, raw);
    assert.equal(result.sourceText, document(raw));
    const diagnostic = result.diagnostics.find(d => d.code === 'ASS_RESET_APPROXIMATION');
    assert.equal(diagnostic.severity, 'warning');
    assert.equal(diagnostic.line, 6);
    assert.match(diagnostic.message, /may differ from libass/);
    assert.equal(result.status, 'partial');
  }
});

test('ASS unchanged r reset has no text-state approximation warning', () => {
  for (const raw of [String.raw`{\r}visible`, String.raw`{\q0\rAlternate}visible`, String.raw`{\i1}visible{\r}text`]) {
    const result = read(raw);
    assert.ok(!result.diagnostics.some(d => d.code === 'ASS_RESET_APPROXIMATION'));
    assert.equal(result.status, 'ok');
  }
});

test('ASS nested r tag is ignored without a reset approximation warning', () => {
  const raw = String.raw`{\q2}a\nb{\t(0,100,\r)}c\nd`;
  const result = read(raw);
  assert.equal(result.cues[0].text, 'a\nbc\nd');
  assert.ok(!result.diagnostics.some(d => d.code === 'ASS_RESET_APPROXIMATION'));
  assert.equal(result.cues[0].rawText, raw);
});
