import {readFileSync,writeFileSync,mkdirSync,readdirSync,copyFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const output=resolve(root,'evidence/quality-013-final'),stage=resolve(root,'.snapshot-quality-013-final');
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
function files(p){return readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(resolve(p,e.name)):[resolve(p,e.name)]);}
const slash=p=>p.replaceAll('\\','/');
if(process.argv[2]==='prepare') {
  const validation=JSON.parse(readFileSync(resolve(root,'evidence/quality-013-validation/validation.json')));
  if(!validation.inputsUnchanged||validation.results.length!==5||validation.results.some(r=>r.exitCode!==0))throw Error('Validation gate');
  for(const f of validation.files)if(hash(resolve(root,f.path))!==f.sha256)throw Error('Workspace changed: '+f.path);
  const fuzz=JSON.parse(readFileSync(resolve(root,'evidence/quality-013-work/fuzz-013-complete/result.json')));
  if(fuzz.failed||!fuzz.distUnchanged||fuzz.durationSeconds<900)throw Error('Fuzz gate');
  for(const f of fuzz.distFiles)if(hash(f.path)!==f.sha256)throw Error('Fuzz inputs changed');
  const browser=JSON.parse(readFileSync(resolve(root,'evidence/quality-013-work/browser-final.json')));
  if(browser.status!=='PASS')throw Error('Browser gate');
  const consumer=JSON.parse(readFileSync(resolve(root,'evidence/quality-013-work/node20-final-artifact.json')));
  const tarball=resolve(root,'independent-subtitle-parser-0.1.3.tgz');
  if(consumer.status!=='PASS'||consumer.tarballSha256!==hash(tarball))throw Error('Node 20 artifact gate');
  mkdirSync(output);mkdirSync(stage);
  const inputPaths=[...new Set([...validation.files.map(f=>resolve(root,f.path)),...files(resolve(root,'dist'))])].sort();
  const inputs=inputPaths.map(p=>({path:slash(relative(root,p)),sha256:hash(p)}));
  for(const f of inputs){const p=resolve(stage,f.path);mkdirSync(dirname(p),{recursive:true});copyFileSync(resolve(root,f.path),p);}
  for(const dir of ['quality-013-validation','quality-013-work'])for(const p of files(resolve(root,'evidence',dir))){const target=resolve(output,dir,relative(resolve(root,'evidence',dir),p));mkdirSync(dirname(target),{recursive:true});copyFileSync(p,target);}
  copyFileSync(tarball,resolve(output,'independent-subtitle-parser-0.1.3.tgz'));
  writeFileSync(resolve(output,'workspace-inputs.json'),JSON.stringify(inputs,null,2)+'\n',{flag:'wx'});
  const verification=`import {readFileSync} from 'node:fs';\nimport {createHash} from 'node:crypto';\nimport {resolve,dirname} from 'node:path';\nimport {fileURLToPath} from 'node:url';\nconst root=dirname(fileURLToPath(import.meta.url));const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');\nconst m=JSON.parse(readFileSync(resolve(root,'manifest.json'))),errors=[];let checked=0;\nfor(const f of m.files){checked++;try{if(hash(resolve(root,f.path))!==f.sha256)errors.push(f.path);}catch{errors.push(f.path);}}\nif(process.argv.includes('--workspace'))for(const f of JSON.parse(readFileSync(resolve(root,'workspace-inputs.json')))){checked++;try{if(hash(resolve(root,'../..',f.path))!==f.sha256)errors.push('workspace:'+f.path);}catch{errors.push('workspace:'+f.path);}}\nconsole.log(JSON.stringify({checked,differences:errors},null,2));if(errors.length)process.exitCode=1;\n`;
  writeFileSync(resolve(output,'verify.mjs'),verification,{flag:'wx'});
  writeFileSync(resolve(output,'prepare-complete.json'),JSON.stringify({at:new Date().toISOString(),sourceFiles:inputs.length,validationFingerprint:validation.sourceFingerprint},null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({stage,output,sourceFiles:inputs.length}));
} else if(process.argv[2]==='finish') {
  if(!existsSync(resolve(output,'prepare-complete.json'))||!existsSync(resolve(output,'source-snapshot.zip'))||!existsSync(resolve(output,'REPORT.md'))||!existsSync(resolve(output,'zip-verification.json')))throw Error('Incomplete freeze preparation');
  const zipCheck=JSON.parse(readFileSync(resolve(output,'zip-verification.json')));if(zipCheck.differences.length)throw Error('ZIP differences');
  for(const f of JSON.parse(readFileSync(resolve(output,'workspace-inputs.json'))))if(hash(resolve(root,f.path))!==f.sha256)throw Error('Workspace changed after prepare');
  const records=files(output).filter(p=>!p.endsWith('manifest.json')).sort().map(p=>({path:slash(relative(output,p)),sha256:hash(p)}));
  writeFileSync(resolve(output,'manifest.json'),JSON.stringify({version:'0.1.3',frozenAt:new Date().toISOString(),files:records},null,2)+'\n',{flag:'wx'});
  console.log('Manifest SHA-256: '+hash(resolve(output,'manifest.json')));
}else throw Error('Use prepare or finish');
