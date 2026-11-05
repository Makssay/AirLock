import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readdirSync,copyFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,relative,resolve,sep} from 'node:path';

if(!process.argv.includes('--publish'))throw Error('Use --publish to publish the public viewer to GitHub Pages');
execFileSync(process.execPath,['scripts/build-public.mjs'],{stdio:'inherit',env:{...process.env,AIRLOCK_BASE:'/AirLock/'}});
const destination=mkdtempSync(join(tmpdir(),'airlock-pages-'));
if(!resolve(destination).startsWith(resolve(tmpdir())+sep))throw Error('Unexpected export path');
const git=(...args)=>execFileSync('git',['-C',destination,...args],{stdio:'inherit'});
execFileSync('git',['clone','--depth','1','--branch','gh-pages','https://github.com/Makssay/AirLock.git',destination],{stdio:'inherit'});
git('config','core.autocrlf','false');
git('config','user.name','Makssay');git('config','user.email','makcumka2005@gmail.com');
console.log('Copying public build');
const buildRoot=resolve('dist');
const buildPaths=[];
function copyBuild(source,target){
  mkdirSync(target,{recursive:true});
  for(const entry of readdirSync(source,{withFileTypes:true})){
    if(entry.isSymbolicLink())throw Error('Unexpected build symlink');
    const from=join(source,entry.name),to=join(target,entry.name);
    if(entry.isDirectory())copyBuild(from,to);
    else {
      copyFileSync(from,to);
      buildPaths.push(relative(buildRoot,from).split(sep).join('/'));
    }
  }
}
copyBuild(buildRoot,destination);
console.log('Writing static publication metadata');
writeFileSync(join(destination,'.nojekyll'),'');
writeFileSync(join(destination,'.gitattributes'),'*.pdf binary\n');
console.log('Staging publication');
git('add','.');
const stagedPaths=()=>new Set(execFileSync('git',['-C',destination,'ls-files','-z'],{encoding:'utf8'}).split('\0'));
const staged=stagedPaths();
for(const file of buildPaths){
  if(staged.has(file))continue;
  // Keep both URL spellings when Windows copied over an older asset with different casing.
  const hash=execFileSync('git',['-C',destination,'hash-object','-w','--',join(buildRoot,file)],{encoding:'utf8'}).trim();
  git('-c','core.ignorecase=false','update-index','--add','--cacheinfo',`100644,${hash},${file}`);
}
const publication=stagedPaths();
const missing=buildPaths.filter(file=>!publication.has(file));
if(missing.length)throw Error(`Missing publication files: ${missing.join(', ')}`);
console.log('Checking publication changes');
const changed=execFileSync('git',['-C',destination,'diff','--cached','--name-only']).toString().trim();
if(changed){git('commit','-m','Publish updated Airlock viewer');git('push','origin','gh-pages');}
execFileSync('gh',['api','repos/Makssay/AirLock/pages/builds','--method','POST'],{stdio:'inherit'});
console.log('\nPages publication requested: https://makssay.github.io/AirLock/');
