import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('..', import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run via npm run check:package.');
const run = (bin, args, cwd = root) => {
  const result = spawnSync(bin, args, { cwd, encoding: 'utf8', timeout: 60_000, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr ?? result.stdout);
  return result.stdout;
};
const packOutput = JSON.parse(run(process.execPath, [npmCli, 'pack', '--json', '--ignore-scripts']));
// npm <=11 emits an array; npm 12 keys the result by package name.
const packed = Array.isArray(packOutput) ? packOutput : Object.values(packOutput);
assert.equal(packed.length, 1);
const tarball = resolve(root, packed[0].filename);
const files = packed[0].files.map(f => f.path);
assert.ok(files.includes('dist/index.js') && files.includes('dist/index.d.ts'));
assert.ok(files.includes('THIRD_PARTY_NOTICES.md'));
assert.ok(files.includes('LICENSE'));
for (const name of ['node.mjs', 'browser.html', 'browser.mjs', 'workflow.mjs', 'parse-worker.mjs', 'worker-client.mjs', 'serve.mjs']) assert.ok(files.includes('examples/' + name));
for (const name of ['API', 'USAGE', 'DIAGNOSTICS', 'DEVELOPMENT']) assert.ok(files.includes('docs/' + name + '.md'));
assert.ok(files.every(f => !['test/', 'node_modules/', 'evidence/', 'research/', 'corpus/', '.runtime-cache/'].some(prefix => f.startsWith(prefix))));
assert.ok(files.every(f => /^(dist\/[\w/-]+\.(js|d\.ts)|examples\/[\w-]+\.(mjs|html)|docs\/[\w-]+\.md|README\.md|CHANGELOG\.md|LICENSE|THIRD_PARTY_NOTICES\.md|package\.json)$/.test(f)), 'Unexpected pack entry');
const digest = (bytes, algorithm = 'sha256', encoding = 'hex') => createHash(algorithm).update(bytes).digest(encoding);
const tarballBytes = readFileSync(tarball);
assert.equal(digest(tarballBytes, 'sha1'), packed[0].shasum);
assert.equal('sha512-' + digest(tarballBytes, 'sha512', 'base64'), packed[0].integrity);
const consumer = resolve(root, '.package-smoke', String(Date.now()));
mkdirSync(consumer, { recursive: true });
writeFileSync(resolve(consumer, 'package.json'), JSON.stringify({ type: 'module', private: true }));
run(process.execPath, [npmCli, 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', resolve(root, '.package-smoke/cache'), tarball], consumer);
writeFileSync(resolve(consumer, 'consumer.mjs'), `import { parse, decode, detectFormat } from 'independent-subtitle-parser';
import assert from 'node:assert/strict';
assert.equal(parse('1\\n00:00:01,000 --> 00:00:02,000\\nhello').cues[0].text, 'hello');
assert.equal(decode(new TextEncoder().encode('hello')).text, 'hello');
assert.equal(detectFormat('WEBVTT').format, 'vtt');
console.log('Installed tarball ESM consumer PASS');`);
console.log(run(process.execPath, ['consumer.mjs'], consumer).trim());
const installed = resolve(consumer, 'node_modules/independent-subtitle-parser');
const packageFiles = files.map(path => {
  // Read actual archive bytes, not npm's reported list alone. No extraction of
  // archive paths onto the filesystem, and no shell command interpolation.
  const entry = spawnSync('tar', ['-xOf', tarball, 'package/' + path], { timeout: 10000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  if (entry.error || entry.status !== 0) throw Error('Could not verify tar entry: ' + path);
  const sha256 = digest(entry.stdout);
  assert.equal(digest(readFileSync(resolve(installed, path))), sha256, 'Installed bytes differ: ' + path);
  assert.equal(digest(readFileSync(resolve(root, path))), sha256, 'Packed bytes differ from source: ' + path);
  return { path, bytes: entry.stdout.length, sha256 };
});
const walkInstalled = (dir, prefix = '') => readdirSync(dir, { withFileTypes: true }).flatMap(f => f.isDirectory() ? walkInstalled(resolve(dir, f.name), prefix + f.name + '/') : [prefix + f.name]);
assert.deepEqual(walkInstalled(installed).sort(), [...files].sort(), 'Installed file inventory differs');
const archiveEntries = run('tar', ['-tzf', tarball]).trim().split(/\r?\n/).map(p => p.replace(/^package\//, ''));
assert.deepEqual(archiveEntries.sort(), [...files].sort(), 'Archive file inventory differs');
const archiveAttributes = run('tar', ['-tvzf', tarball]).trim().split(/\r?\n/).map(line => {
  const mode = line.slice(0, 10), path = line.match(/ package\/([\w./-]+)$/)?.[1];
  assert.match(mode, /^-[rwxStTs-]{9}$/, 'Only regular files may be packaged');
  assert.ok(path && files.includes(path), 'Unrecognized archive attribute entry');
  return { path, mode };
}).sort((a, b) => a.path.localeCompare(b.path));
assert.deepEqual(archiveAttributes.map(f => f.path).sort(), [...files].sort());
run(process.execPath, [npmCli, 'pack', '--json', '--ignore-scripts']);
assert.equal(digest(readFileSync(tarball)), digest(tarballBytes), 'Repeated pack changed bytes');
const artifact = { tarballSha256: digest(tarballBytes), integrity: packed[0].integrity, packageFiles, archiveAttributes };
writeFileSync(resolve(consumer, 'package-evidence.json'), JSON.stringify(artifact, null, 2) + '\n');
const sample = JSON.parse(run(process.execPath, [resolve(installed, 'examples/node.mjs')], consumer));
assert.equal(sample.parsed.cues[0].text, '안녕하세요\nHello');
writeFileSync(resolve(consumer, 'consumer.cjs'), `import('independent-subtitle-parser').then(({parse}) => { if(parse('WEBVTT\\n\\n').status !== 'ok') throw Error('CJS dynamic import failed'); }).catch(e => { console.error(e); process.exitCode=1; });`);
run(process.execPath, ['consumer.cjs'], consumer);
for (const doc of ['README.md', 'docs/USAGE.md']) {
  const content = readFileSync(resolve(installed, doc), 'utf8');
  let i = 0;
  for (const match of content.matchAll(/```ts\r?\n([\s\S]*?)```/g)) {
    const filename = `recipe-${doc.replaceAll('/', '-')}-${i++}.ts`;
    writeFileSync(resolve(consumer, filename), match[1]);
    run(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--moduleDetection', 'force', filename], consumer);
  }
}
for (const doc of files.filter(f => f.endsWith('.md'))) {
  for (const [, target] of readFileSync(resolve(installed, doc), 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
    if (/^(https?:|#)/.test(target)) continue;
    assert.ok(readFileSync(resolve(dirname(resolve(installed, doc)), target.split('#')[0])), `Missing installed doc link: ${doc} -> ${target}`);
  }
}
writeFileSync(resolve(consumer, 'consumer.ts'), `import { parse, decode, type Cue, type ParseResult, type SubtitleFormat } from 'independent-subtitle-parser';
const format: SubtitleFormat = 'sami';
const result: ParseResult = parse('<SAMI></SAMI>', { format });
const cue: Cue | undefined = result.cues[0];
const end: number | null | undefined = cue?.end;
const truncated: boolean = result.diagnosticsTruncated;
decode(new Uint8Array(), { encoding: 'utf-8' });
void end; void truncated;`);
run(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', 'consumer.ts'], consumer);
run(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--target', 'ES2022', '--module', 'ESNext', '--moduleResolution', 'Bundler', 'consumer.ts'], consumer);
const manifest = JSON.parse(readFileSync(resolve(consumer, 'node_modules/independent-subtitle-parser/package.json')));
assert.equal(manifest.private, true);
assert.equal(manifest.license, 'MIT');
assert.match(readFileSync(resolve(installed, 'LICENSE'), 'utf8'), /^MIT License/);
assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0);
console.log(JSON.stringify({ check: 'package-smoke', status: 'PASS', node: process.version, tarball, consumer, ...artifact, packageBytes: packed[0].size, unpackedBytes: packed[0].unpackedSize, files: files.length, checks: ['installed ESM import', 'CommonJS dynamic import', 'installed Node example', 'README and usage TypeScript recipes', 'installed Markdown link targets', 'TypeScript NodeNext declarations', 'TypeScript Bundler declarations', 'publish guard', 'runtime dependency count', 'strict pack allowlist', 'MIT license and third-party notice', 'actual archive/source/installed byte identity', 'repeat pack reproducibility'] }, null, 2));
