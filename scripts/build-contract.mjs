import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const result = spawnSync('cargo', ['build', '--manifest-path', 'contracts/airlock/Cargo.toml', '--release', '--target', 'wasm32v1-none'], {
  stdio: 'inherit',
  env: { ...process.env, RUSTFLAGS: '-C target-cpu=mvp -C link-arg=--import-memory -C link-arg=--max-memory=1048576 -C link-arg=-zstack-size=65536' },
});
if (result.status !== 0) process.exit(result.status || 1);
const input = readFileSync('contracts/airlock/target/wasm32v1-none/release/airlock.wasm');
// Strip linker-created globals from exports. Legacy pallet-contracts permits entry points only.
function leb(bytes, pos) { let n=0, shift=0, i=pos; do { n |= (bytes[i]&127)<<shift; shift+=7; } while(bytes[i++]&128); return [n,i]; }
function enc(n) { const a=[]; do { let b=n&127;n>>>=7;if(n)b|=128;a.push(b); } while(n);return Buffer.from(a); }
const chunks=[input.subarray(0,8)];
for(let p=8;p<input.length;) {
  const id=input[p++];const [length,start]=leb(input,p);const end=start+length;
  let data=input.subarray(start,end);
  if(id===7) {
    let [count,q]=leb(data,0);const kept=[];
    for(let i=0;i<count;i++) { const from=q;let [len,s]=leb(data,q);const name=data.subarray(s,s+len).toString();q=s+len;const kind=data[q++];const [,next]=leb(data,q);q=next;
      if(kind===0 && ['deploy','call'].includes(name)) kept.push(data.subarray(from,q));
    }
    data=Buffer.concat([enc(kept.length),...kept]);
  }
  // Custom debug/name/target sections aren't necessary for execution.
  if(id!==0) chunks.push(Buffer.from([id]),enc(data.length),data);
  p=end;
}
const output=Buffer.concat(chunks);
const module=new WebAssembly.Module(output);
const imports=WebAssembly.Module.imports(module), exports=WebAssembly.Module.exports(module);
if(exports.length!==2 || !exports.every(x=>x.kind==='function' && ['call','deploy'].includes(x.name))) throw Error('Invalid legacy entry points');
if(!imports.some(x=>x.module==='env' && x.name==='memory')) throw Error('Memory must be imported');
mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/airlock.wasm',output);
writeFileSync('artifacts/build.json',JSON.stringify({target:'wasm32v1-none',bytes:output.length,imports,exports},null,2));
console.log(`Built ${resolve('artifacts/airlock.wasm')} (${output.length} bytes)`);
