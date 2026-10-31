import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readdirSync,copyFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';

if(!process.argv.includes('--publish'))throw Error('Use --publish to publish the public viewer to GitHub Pages');
execFileSync(process.execPath,['scripts/build-public.mjs'],{stdio:'inherit',env:{...process.env,AIRLOCK_BASE:'/AirLock/'}});
const destination=mkdtempSync(join(tmpdir(),'airlock-pages-'));
if(!resolve(destination).startsWith(resolve(tmpdir())+sep))throw Error('Unexpected export path');
const git=(...args)=>execFileSync('git',['-C',destination,...args],{stdio:'inherit'});
execFileSync('git',['clone','--depth','1','--branch','gh-pages','https://github.com/Makssay/AirLock.git',destination],{stdio:'inherit'});
git('config','core.autocrlf','false');
git('config','user.name','Makssay');git('config','user.email','makcumka2005@gmail.com');
console.log('Copying public build');
function copyBuild(source,target){mkdirSync(target,{recursive:true});for(const entry of readdirSync(source,{withFileTypes:true})){if(entry.isSymbolicLink())throw Error('Unexpected build symlink');const from=join(source,entry.name),to=join(target,entry.name);if(entry.isDirectory())copyBuild(from,to);else copyFileSync(from,to);}}
copyBuild('dist',destination);
console.log('Writing static publication metadata');
writeFileSync(join(destination,'.nojekyll'),'');
writeFileSync(join(destination,'.gitattributes'),'*.pdf binary\n');
console.log('Staging publication');
git('add','.');
console.log('Checking publication changes');
const changed=execFileSync('git',['-C',destination,'diff','--cached','--name-only']).toString().trim();
if(changed){git('commit','-m','Publish updated Airlock viewer');git('push','origin','gh-pages');}
execFileSync('gh',['api','repos/Makssay/AirLock/pages/builds','--method','POST'],{stdio:'inherit'});
console.log('\nPages publication requested: https://makssay.github.io/AirLock/');
