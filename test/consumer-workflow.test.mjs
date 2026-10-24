import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readSubtitle, selectTrack, formatTime } from '../examples/workflow.mjs';
import { startParse } from '../examples/worker-client.mjs';
const bytes = text => new TextEncoder().encode(text);

test('consumer keeps decoding failure distinct from parsing failure', () => {
  const invalid = readSubtitle(Uint8Array.of(0xff));
  assert.equal(invalid.parsed, null);
  assert.equal(invalid.diagnostics[0].stage, 'decode');
  assert.equal(invalid.diagnostics[0].code, 'INVALID_ENCODING');
  const unknown = readSubtitle(bytes('ordinary text'));
  assert.equal(unknown.parsed.status, 'fatal');
  assert.equal(unknown.diagnostics[0].stage, 'parse');
});
test('replacement warning survives successful parsing', () => {
  const prefix = bytes('1\n00:00:00,000 --> 00:00:01,000\n');
  const result = readSubtitle(Uint8Array.from([...prefix, 0xff]), { replacement: true });
  assert.equal(result.parsed.status, 'ok');
  assert.equal(result.parsed.cues[0].text, '\ufffd');
  assert.deepEqual(result.diagnostics.map(d => [d.stage, d.code]), [['decode', 'DECODE_REPLACEMENT']]);
  assert.equal(result.decodeDiagnostics[0].code, 'DECODE_REPLACEMENT');
  assert.equal(result.parsed.diagnostics.length, 0);
});
test('empty decoded string reaches parser and explicit empty VTT remains usable', () => {
  const empty = readSubtitle(new Uint8Array());
  assert.ok(empty.parsed);
  assert.equal(empty.parsed.status, 'fatal');
  assert.deepEqual(empty.decodeDiagnostics, []);
  const vtt = readSubtitle(bytes('WEBVTT\n\n'));
  assert.equal(vtt.parsed.status, 'ok');
  assert.equal(vtt.parsed.cues.length, 0);
});
test('explicit encoding conflict and options are preserved', () => {
  const result = readSubtitle(Uint8Array.of(0xff,0xfe,65,0), { encoding: 'utf-8', format: 'srt' });
  assert.equal(result.parsed, null);
  assert.equal(result.bom, 'utf-16le');
  assert.equal(result.decodeDiagnostics[0].code, 'ENCODING_BOM_CONFLICT');
  assert.deepEqual(result.options, { encoding: 'utf-8', format: 'srt', replacement: false });
});
test('track selection preserves unknown ends, source order and full result', () => {
  const result = readSubtitle(bytes('<SAMI><SYNC Start=0><P Class=KO>한국어<P Class=EN>English<SYNC Start=1000><P Class=KO>끝</SAMI>')).parsed;
  const ko = result.tracks.find(t => t.sourceClass === 'KO');
  const selected = selectTrack(result, ko.id);
  assert.deepEqual(selected.map(c => [c.start, c.end, c.text]), [[0,1000,'한국어'],[1000,null,'끝']]);
  assert.equal(result.tracks.length, 2);
  assert.equal(result.cues.length, 3);
  assert.throws(() => selectTrack(result, 'absent'), /Unknown track/);
  assert.equal(formatTime(null), 'unknown');
  assert.equal(formatTime(360000001), '100:00:00.001');
});

function fakeWorker() {
  return { terminated: 0, sent: [], terminate() { this.terminated++; }, postMessage(value) { this.sent.push(value); } };
}
test('worker success terminates and ignores stale messages', async () => {
  const worker = fakeWorker();
  const job = startParse('file', {}, { createWorker: () => worker });
  worker.onmessage({ data: { result: 'first' } });
  worker.onmessage({ data: { result: 'stale' } });
  assert.equal(await job.promise, 'first');
  job.cancel();
  assert.equal(worker.terminated, 1);
});
test('cancel terminates active worker and rejects once', async () => {
  const worker = fakeWorker();
  const job = startParse('file', {}, { createWorker: () => worker });
  const rejection = assert.rejects(job.promise, /Cancelled/);
  job.cancel(); job.cancel();
  worker.onmessage({ data: { result: 'late' } });
  await rejection;
  assert.equal(worker.terminated, 1);
});
test('deadline terminates actual pending work', async () => {
  const worker = fakeWorker();
  const job = startParse('file', {}, { timeoutMs: 5, createWorker: () => worker });
  await assert.rejects(job.promise, /deadline/);
  assert.equal(worker.terminated, 1);
});
for (const cause of ['load', 'transfer', 'host', 'send']) test(`worker ${cause} failure rejects and terminates`, async () => {
  const worker = fakeWorker();
  if (cause === 'send') worker.postMessage = () => { throw Error('send failed'); };
  const job = startParse('file', {}, { createWorker: () => worker });
  const rejection = assert.rejects(job.promise);
  if (cause === 'load') worker.onerror();
  if (cause === 'transfer') worker.onmessageerror();
  if (cause === 'host') worker.onmessage({ data: { hostError: 'read failed' } });
  await rejection;
  assert.equal(worker.terminated, 1);
});
test('worker construction failure is a rejected host operation', async () => {
  const job = startParse('file', {}, { createWorker: () => { throw Error('CSP blocked'); } });
  await assert.rejects(job.promise, /CSP blocked/);
  job.cancel();
});

test('Node consumer exit and output contracts on real files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'subtitle-consumer-'));
  const invoke = (...args) => spawnSync(process.execPath, ['examples/node.mjs', ...args], { encoding: 'utf8', windowsHide: true });
  const good = join(dir, 'good.srt');
  writeFileSync(good, '1\n00:00:00,000 -> 00:00:01,000\nHello');
  const partial = invoke(good); assert.equal(partial.status, 0); assert.equal(JSON.parse(partial.stdout).parsed.status, 'partial');
  const bad = join(dir, 'bad.srt'); writeFileSync(bad, Uint8Array.of(0xff));
  const failed = invoke(bad); assert.equal(failed.status, 1); assert.equal(JSON.parse(failed.stdout).parsed, null);
  const wrong = invoke(good, 'auto', 'bogus'); assert.equal(wrong.status, 2); assert.match(JSON.parse(wrong.stderr).hostError, /format/);
  const missing = invoke(join(dir, 'missing')); assert.equal(missing.status, 2); assert.ok(JSON.parse(missing.stderr).hostError);
  const mismatch = invoke(good, 'auto', 'srt', 'absent'); assert.equal(mismatch.status, 2);
  const directory = invoke(dir); assert.equal(directory.status, 2); assert.match(JSON.parse(directory.stderr).hostError, /regular file/);
});
