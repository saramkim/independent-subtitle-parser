import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
const sources = [
  { repo: 'libass/libass', revision: 'f61db567e6593df3470e91594bcd4ad2d0473aff', license: 'ISC', files: ['COPYING', 'compare/test/sub1.ass', 'compare/test/sub2.ass'] },
  { repo: 'microsoft/Windows-classic-samples', revision: '434f6002bdf9cf9829406c3ff2b33387982d6168', license: 'MIT', files: ['LICENSE', 'Samples/Win7Samples/multimedia/WMP/media/ccsample.smi'] },
];
const records = [];
for (const source of sources) for (const file of source.files) {
  const url = `https://raw.githubusercontent.com/${source.repo}/${source.revision}/${file}`;
  const response = await fetch(url);
  if (!response.ok) throw Error(`${response.status}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const path = `corpus/release-015/${source.repo.split('/')[0]}/${file.split('/').at(-1)}`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes, { flag: 'wx' });
  records.push({ path, url, repository: source.repo, revision: source.revision, license: source.license, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
writeFileSync('corpus/release-015/manifest.json', JSON.stringify({ records }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(records, null, 2));
