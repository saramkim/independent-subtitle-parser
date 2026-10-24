import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
if(process.argv.slice(2).some(arg=>arg!=='--local'))throw Error('Usage: node research/corpus-016/acquire.mjs [--local]');
const manifest=JSON.parse(readFileSync(new URL(process.argv.includes('--local')?'./local-manifest.json':'../../corpus/corpus-016/manifest.json',import.meta.url)));
for(const record of manifest.records) {
 const path=resolve(root,record.path);
 const bytes=existsSync(path)?readFileSync(path):await (async()=>{
  const response=await fetch(record.url,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`${response.status}: ${record.url}`);
  return Buffer.from(await response.arrayBuffer());
 })();
 if(bytes.length!==record.bytes||createHash('sha256').update(bytes).digest('hex')!==record.sha256)throw Error(`Source changed: ${record.id}`);
 if(!existsSync(path)){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes,{flag:'wx'});}
}
console.log(`Verified ${manifest.records.length} pinned files`);
