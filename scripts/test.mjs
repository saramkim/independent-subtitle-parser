import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Node 20 on Windows does not expand CLI test globs. Enumerate explicitly.
const directory=new URL('../test/',import.meta.url);
const files=readdirSync(directory).filter(n=>n.endsWith('.test.mjs')).sort().map(n=>fileURLToPath(new URL(n,directory)));
if(!files.length)throw Error('No test files found');
const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit',windowsHide:true});
if(result.error)throw result.error;
process.exitCode=result.status??1;
