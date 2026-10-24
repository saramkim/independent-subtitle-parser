import test from 'node:test';
import assert from 'node:assert/strict';
import {decode} from '../dist/index.js';
// Independent numeric transcription of WHATWG index-windows-1252.txt entries
// 0..31. Remaining bytes map to the same code point as their byte value.
// https://encoding.spec.whatwg.org/index-windows-1252.txt
const expectedC1=[8364,129,8218,402,8222,8230,8224,8225,710,8240,352,8249,338,141,381,143,144,8216,8217,8220,8221,8226,8211,8212,732,8482,353,8250,339,157,382,376];
for(const label of ['windows-1252','iso-8859-1','latin1','ascii'])test(`WHATWG ${label} aliases decode every byte across runtimes`,()=>{
  const bytes=Uint8Array.from({length:256},(_,i)=>i);
  const expected=String.fromCodePoint(...Array.from({length:256},(_,i)=>i>=128&&i<=159?expectedC1[i-128]:i));
  for(const fatal of [true,false]){const r=decode(bytes,{encoding:label,fatal});assert.equal(r.text,expected);assert.equal(r.encoding,'windows-1252');assert.deepEqual(r.diagnostics,[]);}
});
test('Windows-1252 correction respects view boundaries and does not remap UTF-8 controls',()=>{
  const bytes=Uint8Array.of(0,128,145,159,255);
  assert.equal(decode(bytes.subarray(1,4),{encoding:'windows-1252'}).text,'€‘Ÿ');
  assert.equal(decode(new TextEncoder().encode('\u0080\u0091')).text,'\u0080\u0091');
});
