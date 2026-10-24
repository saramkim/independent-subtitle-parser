// Test-only server: serve the installed tarball, not workspace example modules.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
const [packagePath, outputPath, portArg] = process.argv.slice(2);
if (!packagePath || !outputPath || process.argv.length > 5) throw Error('Usage: node scripts/browser-consumer-test.mjs <installed-package> <new-report.json> [port]');
const port = Number(portArg ?? 4179);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid loopback test port');
const root=resolve(packagePath), output=resolve(outputPath);
if(existsSync(output))throw Error('Report already exists');
const manifest=JSON.parse(readFileSync(resolve(root,'package.json')));
const tarballSha256=createHash('sha256').update(readFileSync(`${manifest.name}-${manifest.version}.tgz`)).digest('hex');
createServer(async(req,res)=>{
  try {
    const path=new URL(req.url,'http://127.0.0.1').pathname;
    if(path==='/__result'&&req.method==='POST'){
      let body='';for await(const chunk of req){body+=chunk;if(body.length>64000)throw Error('Report too large');}
      const report=JSON.parse(body);writeFileSync(output,JSON.stringify({...report,at:new Date().toISOString(),installedPackage:root,tarballSha256},null,2)+'\n',{flag:'wx'});res.end('saved');return;
    }
    if(req.method!=='GET'){res.writeHead(405).end();return;}
    if(path==='/__tests.html'){res.setHeader('Content-Type','text/html');res.end(readFileSync('test/browser-consumer.html'));return;}
    if(path==='/__busy.mjs'){res.setHeader('Content-Type','text/javascript');res.end('onmessage=()=>{postMessage({ready:true});while(true){}};');return;}
    const file=resolve(root,'.'+decodeURIComponent(path));const name=relative(root,file).split(sep).join('/');
    if(!/^(examples\/[\w-]+\.(html|mjs)|dist\/[\w/-]+\.js)$/.test(name)){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',name.endsWith('.html')?'text/html':'text/javascript');res.setHeader('Cache-Control','no-store');res.end(readFileSync(file));
  }catch(e){res.writeHead(500).end(String(e));}
}).listen(port,'127.0.0.1',()=>console.log(`http://127.0.0.1:${port}/__tests.html`));
