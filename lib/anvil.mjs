import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createServer } from 'node:net';
import { JsonRpcProvider } from 'ethers';
const require=createRequire(import.meta.url);
const platform={win32:'win32',linux:'linux',darwin:'darwin'}[process.platform];
const arch={x64:'amd64',arm64:'arm64'}[process.arch];
export function anvilBinary(){
 if(process.env.ANVIL_BIN)return process.env.ANVIL_BIN;
 const packagePath=require.resolve(`@foundry-rs/anvil-${platform}-${arch}/package.json`);
 return join(dirname(packagePath),'bin',process.platform==='win32'?'anvil.exe':'anvil');
}
async function unusedPort(){const server=createServer();await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).on('error',reject));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
export async function startAnvil({port=0}={}){
 port=port||await unusedPort();const endpoint=`http://127.0.0.1:${port}`;
 const child=spawn(anvilBinary(),['--host','127.0.0.1','--port',String(port),'--chain-id','31337','--balance','100000','--timestamp','1800000000','--silent'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
 let failed,stderr='';child.on('error',e=>{failed=e;});child.stderr.on('data',b=>{stderr+=b.toString();});
 let ready=false;
 for(let i=0;i<100;i++){
  if(failed||child.exitCode!==null){child.kill();throw failed||Error(`Anvil exited: ${stderr}`);}
  try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]}),signal:AbortSignal.timeout(300)});const d=await r.json();if(d.result==='0x7a69'){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 if(!ready){child.kill();throw Error(`Anvil did not start: ${stderr}`);}
 const provider=new JsonRpcProvider(endpoint,31337,{staticNetwork:true});provider.pollingInterval=10;
 return {endpoint,provider,request:({method,params=[]})=>provider.send(method,params),close:async()=>{provider.destroy();child.kill();}};
}
