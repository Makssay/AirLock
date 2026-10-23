import {execFileSync} from 'node:child_process';
import {mkdirSync,copyFileSync} from 'node:fs';
execFileSync(process.execPath,['node_modules/vite/bin/vite.js','build','--mode','public'],{stdio:'inherit'});
mkdirSync('dist/evidence',{recursive:true});
for(const name of ['v3-attack-demo.json','v3-console-e2e.json','v3-live-evidence.json'])copyFileSync('artifacts/'+name,'dist/evidence/'+name);
copyFileSync('docs/check-in/architecture.svg','dist/evidence/architecture.svg');
