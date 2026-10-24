import { formatTime, MAX_FILE_BYTES, selectTrack } from './workflow.mjs';
import { startParse } from './worker-client.mjs';
const $ = id => document.getElementById(id);
let file = null, job = null, generation = 0, result = null, trackPage = 0;
const TRACK_PAGE_SIZE = 100;
const short = (text, max = 5000) => text.length > max ? text.slice(0, max) + '\n[Preview shortened; full text is in JSON.]' : text;

function invalidate(message) {
  generation++;
  job?.cancel();
  job = null;
  result = null;
  trackPage = 0;
  $('output').hidden = true;
  $('cues').replaceChildren();
  $('track').replaceChildren();
  for (const id of ['source', 'diagnostics', 'summary', 'count']) $(id).textContent = '';
  $('cancel').disabled = true;
  $('parse').disabled = !file;
  $('status').textContent = message;
}
function renderTrackOptions() {
  const tracks = result?.parsed?.tracks ?? [];
  const start = trackPage * TRACK_PAGE_SIZE;
  $('track').replaceChildren();
  for (let i = start; i < Math.min(start + TRACK_PAGE_SIZE, tracks.length); i++) {
    const track = tracks[i];
    const option = document.createElement('option'); option.value = track.id;
    option.textContent = `${i + 1}. ` + short([track.id, track.label, track.language, track.sourceClass].filter(Boolean).join(' · '), 200);
    $('track').append(option);
  }
  $('track').disabled = !tracks.length;
  $('track-page').textContent = tracks.length ? `Tracks ${start + 1}–${Math.min(start + TRACK_PAGE_SIZE, tracks.length)} of ${tracks.length}. Long labels are shortened; full values remain in JSON.` : 'No tracks.';
  $('track-prev').disabled = trackPage === 0;
  $('track-next').disabled = start + TRACK_PAGE_SIZE >= tracks.length;
  renderTrack();
}
function renderTrack() {
  const parsed = result?.parsed;
  $('cues').replaceChildren();
  if (!parsed || parsed.status === 'fatal' || !parsed.tracks.length) {
    $('count').textContent = 'No usable cues to preview.';
    return;
  }
  const cues = selectTrack(parsed, $('track').value);
  $('count').textContent = `${cues.length} cues in this track; showing ${Math.min(100, cues.length)}. Source order and overlaps retained. Times are milliseconds formatted as HH:MM:SS.mmm.`;
  for (const cue of cues.slice(0, 100)) {
    const article = document.createElement('article');
    const time = document.createElement('strong');
    time.textContent = `${formatTime(cue.start)} → ${formatTime(cue.end)} (source lines ${cue.source.line}–${cue.source.endLine})`;
    const text = document.createElement('pre');
    text.textContent = short(cue.text);
    const raw = document.createElement('details');
    const title = document.createElement('summary'); title.textContent = 'Raw cue text';
    const payload = document.createElement('pre'); payload.textContent = short(cue.rawText);
    raw.append(title, payload); article.append(time, text, raw); $('cues').append(article);
  }
}
function render() {
  const parsed = result.parsed;
  $('output').hidden = false;
  $('summary').textContent = `Encoding: ${result.encoding ?? 'unknown'} (requested: ${result.options.encoding ?? 'UTF-8/BOM'}); BOM: ${result.bom ?? 'none'}; replacement: ${result.options.replacement}; parse: ${parsed?.status ?? 'not run (decode failed)'}; format: ${parsed?.format ?? 'unknown'} (requested: ${result.options.format ?? 'content detection'}); returned cues: ${parsed?.cues.length ?? 0}; tracks: ${parsed?.tracks.length ?? 0}.`;
  renderTrackOptions();
  $('diagnostic-count').textContent = `${result.diagnostics.length} returned diagnostics; showing ${Math.min(100, result.diagnostics.length)}. Parser diagnostics truncated: ${parsed?.diagnosticsTruncated ?? false}.`;
  $('diagnostics').textContent = result.diagnostics.slice(0, 100).map(d => `[${d.stage}/${d.severity}] ${d.code}${d.line ? ` (line ${d.line})` : ''}: ${short(d.message, 1000)}`).join('\n') || 'No diagnostics.';
  $('source').textContent = short(parsed?.sourceText ?? '', 10_000);
  $('source-note').textContent = parsed ? `${parsed.sourceText.length} decoded UTF-16 code units; preview limit 10,000.` : 'No decoded source: decoding failed.';
}
async function run() {
  if (!file) return;
  invalidate(`Reading ${file.name}…`);
  if (file.size > MAX_FILE_BYTES) { $('status').textContent = 'File exceeds the example limit of 16 MiB. No file contents were read.'; return; }
  const current = generation;
  $('cancel').disabled = false;
  try {
    job = startParse(file, { encoding: $('encoding').value || undefined, format: $('format').value || undefined, replacement: $('replacement').checked });
    const next = await job.promise;
    if (current !== generation) return;
    result = next;
    render();
    $('status').textContent = !result.parsed ? 'Decoding failed. Check encoding and diagnostics.' : result.parsed.status === 'fatal' ? 'Parsing failed. Check diagnostics; no cues returned.' : result.parsed.cues.length === 0 ? 'Completed with no cues. Inspect diagnostics and source.' : result.diagnostics.length ? 'Completed with diagnostics. Review them before using the cues.' : 'Completed.';
  } catch (error) {
    if (current === generation) $('status').textContent = `Host error: ${error.message}`;
  } finally {
    if (current === generation) { job = null; $('cancel').disabled = true; }
  }
}
$('file').addEventListener('change', () => { file = $('file').files[0] ?? null; invalidate(file ? `${file.name} selected. Choose options, then parse.` : 'No file selected.'); });
for (const id of ['encoding', 'format', 'replacement']) $(id).addEventListener('change', () => invalidate('Options changed. Parse again to apply them.'));
$('parse').addEventListener('click', run);
$('cancel').addEventListener('click', () => invalidate('Cancelled. No result from the cancelled job will be shown.'));
$('track').addEventListener('change', renderTrack);
$('track-prev').addEventListener('click', () => { if (trackPage > 0) { trackPage--; renderTrackOptions(); } });
$('track-next').addEventListener('click', () => { if ((trackPage + 1) * TRACK_PAGE_SIZE < (result?.parsed?.tracks.length ?? 0)) { trackPage++; renderTrackOptions(); } });
$('sample').addEventListener('click', () => {
  const source = '<SAMI><HEAD><STYLE>.KO { Name: Korean; lang: ko-KR; } .EN { Name: English; lang: en-US; }</STYLE></HEAD><BODY>\n<SYNC Start=1000><P Class=KO>안녕하세요<BR>두 번째 줄<P Class=EN>Hello<BR>Second line\n<SYNC Start=3000><P Class=KO>끝<P Class=EN>End\n</BODY></SAMI>';
  file = new File([source], 'bilingual.smi', { type: 'text/plain' });
  $('file').value = ''; $('encoding').value = ''; $('format').value = ''; $('replacement').checked = false;
  run();
});
$('download').addEventListener('click', () => {
  if (!result) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'subtitle-result.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
addEventListener('pagehide', () => { generation++; job?.cancel(); });
