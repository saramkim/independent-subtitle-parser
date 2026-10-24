import test from 'node:test';
import assert from 'node:assert/strict';
import { parse,detectFormat } from '../dist/index.js';
test('WebVTT header recovery never turns the preceding header line into a cue identifier',()=>{
  const source='WEBVTT\n\0\nheader metadata\n00:00.000 --> 00:01.000\nspoken';
  const r=parse(source);
  assert.equal(r.cues.length,1);assert.equal(r.cues[0].id,undefined);assert.equal(r.cues[0].text,'spoken');
  assert.equal(r.metadata[0].raw,'WEBVTT\n\uFFFD\nheader metadata');
  assert.deepEqual(r.cues[0].source,{line:4,endLine:5});assert.equal(r.sourceText,source);
  assert.ok(r.diagnostics.some(d=>d.code==='MISSING_SEPARATOR'));
});
test('SRT single-dash arrow in Blender Portuguese files is recovered with a warning',()=>{
  const source='1\n00:00:23,000 -> 00:00:24,500\nVocê é um idiota, Thom.\n\n2\n00:00:25,000 -> 00:00:27,000\nOlha Célia';
  const r=parse(source);
  assert.equal(detectFormat(source).format,'srt');
  assert.deepEqual(r.cues.map(c=>[c.start,c.end,c.text]),[[23000,24500,'Você é um idiota, Thom.'],[25000,27000,'Olha Célia']]);
  assert.ok(r.diagnostics.some(d=>d.code==='SRT_ARROW_RECOVERED'));assert.equal(r.status,'partial');assert.equal(r.sourceText,source);
});
test('SRT single-dash recovery also recognizes a missing separator without losing either cue',()=>{
  const r=parse('1\n00:00:01,000 -> 00:00:02,000\nA\n2\n00:00:02,000 -> 00:00:03,000\nB',{format:'srt'});
  assert.deepEqual(r.cues.map(c=>c.text),['A','B']);assert.ok(r.diagnostics.some(d=>d.code==='MISSING_SEPARATOR'));
});
test('single-dash arrow recovery does not apply to WebVTT',()=>{
  assert.equal(parse('WEBVTT\n\n00:01.000 -> 00:02.000\nx',{format:'vtt'}).cues.length,0);
});
test('SRT Indonesian terminal punctuation after the end clock is recovered explicitly',()=>{
  const source='9\n00:00:43,000 --> 00:00:45,000.\nTerserah, Thom. Kita selesai.';
  const r=parse(source);assert.deepEqual(r.cues.map(c=>[c.start,c.end,c.text]),[[43000,45000,'Terserah, Thom. Kita selesai.']]);
  assert.ok(r.diagnostics.some(d=>d.code==='SRT_END_PUNCTUATION'));assert.equal(r.sourceText,source);
  for(const bad of ['00:00:45,000..','00:00:45,0001','00:00:45,000x'])assert.equal(parse(source.replace('00:00:45,000.',bad)).cues.length,0);
});
test('unterminated WebVTT markup preservation is explicitly diagnosed',()=>{
  for(const payload of ['&<','<v A < B','<00:00.500']) {
    const r=parse('WEBVTT\n\n00:00.000 --> 00:10.000\n'+payload);
    assert.equal(r.cues[0].rawText,payload);assert.equal(r.cues[0].text,payload);
    assert.equal(r.status,'partial');assert.ok(r.diagnostics.some(d=>d.code==='UNTERMINATED_MARKUP'));
  }
});
