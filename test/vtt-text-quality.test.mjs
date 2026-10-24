import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { parse } from '../dist/index.js';

// Independently authored from W3C WebVTT CRD 2026-05-20 §4.2.2:
// class exclusions are TAB/LF/CR/SPACE/&/</>/dot, not ECMAScript \s;
// annotation text excludes LF/CR/&/> but allows literal '<'.
// https://www.w3.org/TR/2026/CRD-webvtt1-20260520/#webvtt-cue-text
const source = payload => `WEBVTT\n\n00:01.000 --> 00:02.000\n${payload}`;
for (const [label, space] of [['NBSP','\u00a0'],['OGHAM','\u1680'],['EN SPACE','\u2002'],['LINE SEPARATOR','\u2028'],['PARAGRAPH SEPARATOR','\u2029'],['IDEOGRAPHIC','\u3000'],['FORM FEED','\f'],['VERTICAL TAB','\v']]) {
  test(`WebVTT valid ${label} within class name is metadata, not dialogue`, () => {
    const opening = `<c.a${space}b.secondary>`;
    const input = source(`${opening}한국어 &amp; العربية</c>`);
    const result = parse(input);
    assert.equal(result.cues[0]?.text, '한국어 & العربية');
    assert.equal(result.status, 'ok');
    assert.equal(result.sourceText, input);
    assert.equal(result.cues[0].rawText, `${opening}한국어 &amp; العربية</c>`);
    assert.deepEqual(result.cues[0].fields.filter(f=>f.name==='markup').map(f=>f.value), [opening,'</c>']);
  });
}
for (const annotation of ['A < B','<speaker>','A << B','a\u2028b < c','"A < B"',"A ' < B",'&lt;A &amp; B']) {
  // '>' terminates an annotation, so use an encoded > for the angle-pair case.
  const valid = annotation.replaceAll('>', '&gt;');
  test(`WebVTT annotation ${JSON.stringify(valid)} does not expose markup`, () => {
    const opening = `<v.person ${valid}>`;
    const result = parse(source(`${opening}spoken</v>`));
    assert.equal(result.cues[0]?.text, 'spoken');
    assert.equal(result.status, 'ok');
    assert.ok(result.cues[0].fields.some(f=>f.name==='markup'&&f.value===opening));
  });
}
test('WebVTT adjacent annotated spans and timestamps preserve text exactly once', () => {
  const payload = '<v A < B>A &amp;</v><00:01.500><c.a\u00a0b>B</c>';
  const result = parse(source(payload));
  assert.equal(result.cues[0].text,'A &B');
  assert.equal(result.cues[0].rawText,payload);
  assert.deepEqual(result.cues[0].fields.filter(f=>f.name==='timestamp'),[{name:'timestamp',value:'00:01.500'}]);
});
test('SRT markup keeps its separate quote handling and literal comparisons', () => {
  const result = parse('1\n00:00:01,000 --> 00:00:02,000\n<font title="A > B">x</font> 2 < 3 > 1');
  assert.equal(result.cues[0].text,'x 2 < 3 > 1');
});
test('unterminated WebVTT annotation is preserved rather than silently discarded', () => {
  const payload='<v A < B';
  const result=parse(source(payload));
  assert.equal(result.cues[0].text,payload);
  assert.equal(result.sourceText,source(payload));
});
test('long class chains and annotation delimiters terminate within an enforceable child timeout', () => {
  const entry=new URL('../dist/index.js',import.meta.url).href;
  const code=`import {parse} from ${JSON.stringify(entry)};
    const payloads=['<c'+'.x'.repeat(100000)+'>x</c>','<v '+'<'.repeat(200000)+'>x</v>','<c'+'.x'.repeat(100000)+'&>x</c>'];
    for(const payload of payloads){ const text='WEBVTT\\n\\n00:01.000 --> 00:02.000\\n'+payload;const r=parse(text);if(r.sourceText!==text||r.cues.length!==1)process.exit(2);}
    process.stdout.write('done');`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',code],{timeout:5000,encoding:'utf8',windowsHide:true});
  assert.equal(child.error,undefined,String(child.error));assert.equal(child.status,0,child.stderr);assert.equal(child.stdout,'done');
});
