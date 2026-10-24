// Local read-only example server. Works from a checkout or the installed package.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative, sep } from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.SUBTITLE_EXAMPLE_PORT ?? 4178);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.md': 'text/plain', '.json': 'application/json' };
createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    const url = new URL(req.url, 'http://127.0.0.1');
    const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/examples/browser.html' : url.pathname));
    const name = relative(root, path).split(sep).join('/');
    // Do not serve workspace evidence, dependencies, dotfiles or arbitrary files.
    if (!/^(?:examples\/[\w-]+\.(?:html|mjs)|dist\/[\w/-]+\.js|docs\/[\w-]+\.md|README\.md|CHANGELOG\.md|THIRD_PARTY_NOTICES\.md|LICENSE)$/.test(name)) { res.writeHead(403).end(); return; }
    const extension = path.slice(path.lastIndexOf('.'));
    const body = await readFile(path);
    res.setHeader('Content-Type', `${name === 'LICENSE' ? 'text/plain' : types[extension] ?? 'application/octet-stream'}; charset=utf-8`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404).end(); }
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/examples/browser.html`));
