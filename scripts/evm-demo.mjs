import { JsonRpcProvider, ContractFactory, id } from 'ethers';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const endpoint=process.env.AIRLOCK_EVM_RPC||'http://127.0.0.1:8545';
const url=new URL(endpoint);
if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw Error('This demo is restricted to a local development node');
const provider=new JsonRpcProvider(endpoint);provider.pollingInterval=50;
try{
 const network=await provider.getNetwork();if(network.chainId!==31337n)throw Error('Expected local development chain ID 31337');
 const relay=await provider.getSigner(0),guardian=await provider.getSigner(1),recipient=await provider.getSigner(2);
 const a=JSON.parse(readFileSync('artifacts/evm/Airlock.json','utf8'));const U=1000000000000000000n,domain=id('airlock:external-testnet:v1');
 const c=await new ContractFactory(a.abi,a.bytecode,relay).deploy(await relay.getAddress(),await guardian.getAddress(),domain,[25n*U,100n*U,120,400n*U],600,300,100n*U,{value:1000n*U});await c.waitForDeployment();
 const receipts=[];
 const record=async(label,p)=>{const r=await(await p).wait();receipts.push({label,transactionHash:r.hash,blockHash:r.blockHash,blockNumber:r.blockNumber,status:r.status,gasUsed:r.gasUsed.toString(),events:r.logs.map(l=>{try{const e=c.interface.parseLog(l);return e?.name;}catch{return null;}}).filter(Boolean)});};
 await record('deployment',Promise.resolve(c.deploymentTransaction()));
 await record('normal release',c.submit(domain,1,await recipient.getAddress(),20n*U));
 for(let n=2;n<=7;n++)await record('compromised relay split request',c.submit(domain,n,await recipient.getAddress(),25n*U));
 await record('large request quarantined',c.submit(domain,8,await recipient.getAddress(),80n*U));
 try{await record('oversized drain attempt',c.submit(domain,9,await recipient.getAddress(),900n*U,{gasLimit:500000}));throw Error('Oversized drain unexpectedly succeeded');}
 catch(e){if(!e.receipt||e.receipt.status!==0)throw e;const r=e.receipt;receipts.push({label:'oversized drain rejected',transactionHash:r.hash,blockHash:r.blockHash,blockNumber:r.blockNumber,status:0,gasUsed:r.gasUsed.toString(),events:[]});}
 await record('guardian pause',c.connect(guardian).pause());
 for(let n=5;n<=8;n++)await record('guardian cancellation',c.connect(guardian).cancel(await c.messageId(domain,n)));
 const balance=await provider.send('eth_getBalance',[await c.getAddress(),'latest']);
 const evidence={mode:'local-evm-chain',portaldotDeployment:false,reviveCompatibility:'unverified',endpoint,chainId:network.chainId.toString(),contract:await c.getAddress(),genesis:(await provider.getBlock(0)).hash,amountDecimals:18,vaultBalanceBaseUnits:BigInt(balance).toString(),reserved:(await c.reserved()).toString(),receipts};
 mkdirSync('deployments',{recursive:true});writeFileSync('deployments/evm-demo.local.json',JSON.stringify(evidence,null,2));
 mkdirSync('artifacts/evm',{recursive:true});writeFileSync('artifacts/evm/local-chain-evidence.json',JSON.stringify(evidence,null,2));
 console.log(JSON.stringify({contract:evidence.contract,transactions:receipts.length,vaultBalanceBaseUnits:evidence.vaultBalanceBaseUnits,reserved:evidence.reserved,evidence:'deployments/evm-demo.local.json'},null,2));
}finally{provider.destroy();}
