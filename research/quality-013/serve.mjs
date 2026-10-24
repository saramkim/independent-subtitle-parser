import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {wptText,realFiles} from './corpus.mjs';
import {checkedWptCases,realOracle,preservedWptTextDifferences} from './oracles.mjs';
import {formatCases} from './format-cases.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const outputName=process.argv[2]??'browser.json';
if(!/^browser(?:-[a-z]+)?\.json$/.test(outputName))throw Error('Invalid browser report basename');
const cases={wpt:checkedWptCases().filter(f=>f.assertions.length),projections:wptText().map(f=>({...f,policy:preservedWptTextDifferences.get(f.id)??null})),real:realFiles().map(f=>({id:f.id,source:f.source,...realOracle(f)})),formats:formatCases};
http.createServer(async(req,res)=>{try{
  if(req.url==='/cases.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(cases));return;}
  if(req.method==='POST'&&req.url==='/save'){
    let body='';for await(const c of req){body+=c;if(body.length>2000000)throw Error('body limit');}
    fs.writeFileSync(path.join(root,'evidence/quality-013-work',outputName),JSON.stringify(JSON.parse(body),null,2)+'\n',{flag:'wx'});res.end('saved');return;
  }
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root)||!['.html','.js'].includes(path.extname(file)))throw Error('path');
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(fs.readFileSync(file));
}catch(e){res.writeHead(500);res.end(String(e));}}).listen(8768,'127.0.0.1',()=>console.log('http://127.0.0.1:8768/research/quality-013/browser.html'));
