import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { resolve, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw Error('Use npm run validate.');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--output')) throw Error('Usage: npm run validate -- [--output evidence/<new-directory>]');
const evidenceRoot = resolve(root, 'evidence');
const output = resolve(root, args[1] ?? `evidence/runs/${new Date().toISOString().replaceAll(':', '-')}-${randomBytes(3).toString('hex')}`);
if (!output.startsWith(evidenceRoot + sep)) throw Error('Validation output must be a new directory inside evidence/.');
for (let parent = dirname(output); parent !== evidenceRoot; parent = dirname(parent)) {
  if (existsSync(resolve(parent, 'manifest.json')) || existsSync(resolve(parent, 'validation.json'))) {
    throw Error('Cannot place a new run inside existing validation evidence.');
  }
}
// Exclusive creation prevents overwriting either phase-one or later frozen runs.
mkdirSync(dirname(output), { recursive: true });
mkdirSync(output);
const inputs = ['src', 'test', 'scripts', 'examples', 'docs', 'corpus', 'research/quality-013', 'research/release-015', '.github', '.gitattributes', 'LICENSE', 'CHANGELOG.md', 'README.md', 'THIRD_PARTY_NOTICES.md', 'package.json', 'package-lock.json', 'tsconfig.json', 'entities.reference.json', '.gitignore', 'research/reference-parsers/package.json', 'research/reference-parsers/package-lock.json', 'research/reference-parsers/probe.mjs', 'research/reference-parsers/fixtures.mjs'];
function files(path) {
  try { return readdirSync(path, { withFileTypes: true }).filter(entry => entry.name !== 'node_modules').flatMap(entry => entry.isDirectory() ? files(resolve(path, entry.name)) : [resolve(path, entry.name)]); }
  catch (error) { if (error.code === 'ENOTDIR') return [path]; throw error; }
}
function fingerprint() {
  const list = inputs.flatMap(p => files(resolve(root, p))).sort().map(path => ({ path: relative(root, path).replaceAll('\\', '/'), sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }));
  return { sha256: createHash('sha256').update(JSON.stringify(list)).digest('hex'), files: list };
}
const before = fingerprint();
// Archives can be validated without Git; a checkout also records its exact HEAD
// and whether the run started with local changes. The fingerprint covers bytes.
const gitHead = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 10000 });
const gitStatus = gitHead.status === 0
  ? spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=normal'], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 10000 })
  : null;
const git = gitHead.status === 0 ? {
  head: gitHead.stdout.trim(),
  dirty: gitStatus?.status === 0 ? gitStatus.stdout.length > 0 : null,
} : null;
const tests = files(resolve(root, 'test')).filter(path => path.endsWith('.test.mjs')).sort();
if (!tests.length) throw Error('No tests discovered.');
const commands = [
  ['build', process.execPath, [npmCli, 'run', 'build']],
  ['test', process.execPath, ['--test', '--test-reporter=tap', ...tests]],
  ['package', process.execPath, [npmCli, 'run', 'check:package']],
  ['node-example', process.execPath, ['examples/node.mjs']],
  ['benchmark', process.execPath, ['scripts/benchmark.mjs']],
];
const results = [];
for (const [name, bin, args] of commands) {
  const start = performance.now();
  const result = spawnSync(bin, args, { cwd: root, encoding: 'utf8', timeout: 60_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  writeFileSync(resolve(output, `${name}.log`), result.stdout + result.stderr);
  results.push({ name, exitCode: result.status, durationMs: Math.round(performance.now() - start), ...(result.error ? { error: result.error.message } : {}) });
  console.log(`${name}: ${result.status === 0 ? 'PASS' : 'FAIL'}`);
  if (result.status !== 0) break;
}
const after = fingerprint();
const summary = { validatedAtUtc: new Date().toISOString(), node: process.version, platform: process.platform, arch: process.arch, git, sourceFingerprint: before.sha256, inputsUnchanged: before.sha256 === after.sha256, testFiles: tests.map(path => relative(root, path).replaceAll('\\', '/')), results, files: after.files };
writeFileSync(resolve(output, 'validation.json'), JSON.stringify(summary, null, 2) + '\n');
if (results.length !== commands.length || results.some(r => r.exitCode !== 0) || !summary.inputsUnchanged) process.exitCode = 1;
else console.log(`Input fingerprint: ${before.sha256}`);
