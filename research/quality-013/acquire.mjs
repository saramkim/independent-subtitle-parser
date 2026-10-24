import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
const root = new URL('../../corpus/', import.meta.url);
const revision = 'ab209eeecc95915675cde8d26ede4b2d803b4055';
const records = [];
async function bytes(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw Error(`${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}
async function save(path, url, provenance) {
  const data = await bytes(url), target = new URL(path, root);
  mkdirSync(dirname(target.pathname.replace(/^\/(?=[A-Z]:)/i, '')), { recursive: true });
  writeFileSync(target, data, { flag: 'wx' });
  records.push({ path, url, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex'), ...provenance });
}
const queue = [];
for (const [folder, sha] of [['cue-text-parsing','f02cd177c24059930d3e100e503adb04c569a30f'],['file-parsing','8c89bb2f832bb0f930a1c9fd060daed476ce9f4d']]) {
  const { tree } = JSON.parse(await bytes(`https://api.github.com/repos/web-platform-tests/wpt/git/trees/${sha}?recursive=1`));
  for (const item of tree) if (item.type === 'blob' && !item.path.endsWith('.py')) {
    const path = `webvtt/parsing/${folder}/${item.path}`;
    queue.push(() => save(`wpt/${path}`, `https://raw.githubusercontent.com/web-platform-tests/wpt/${revision}/${path}`,
      { kind: 'upstream-conformance', revision, gitBlob: item.sha, license: 'BSD-3-Clause; see wpt/LICENSE.md' }));
  }
}
queue.push(() => save('wpt/LICENSE.md', `https://raw.githubusercontent.com/web-platform-tests/wpt/${revision}/LICENSE.md`, {kind:'license',revision}));
queue.push(() => save('blender/sharing.html', 'https://mango.blender.org/sharing/', {kind:'license', license:'CC-BY-3.0'}));
queue.push(() => save('blender/download.html', 'https://mango.blender.org/download/', {kind:'provenance'}));
const base = 'https://download.blender.org/demo/movies/ToS/subtitles/';
const listing = (await bytes(base)).toString('utf8');
for (const [, name] of listing.matchAll(/href="([^"/]+\.srt)"/g)) queue.push(() => save(`blender/${name}`, base + name,
  {kind:'real-file',format:'srt',license:'CC-BY-3.0',attribution:'(CC) Blender Foundation | mango.blender.org; Tears of Steel volunteer translators',modifications:'none'}));
await Promise.all(Array.from({ length: 6 }, async () => { while(queue.length) await queue.shift()(); }));
records.sort((a,b)=>a.path.localeCompare(b.path));
writeFileSync(new URL('manifest.json', root), JSON.stringify({ acquiredAtUtc: new Date().toISOString(), records },null,2)+'\n', {flag:'wx'});
console.log(`Saved ${records.length} files, ${records.reduce((s,r)=>s+r.bytes,0)} bytes`);
