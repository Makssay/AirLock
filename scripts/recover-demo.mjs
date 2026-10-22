// Recover only the already-recorded quarantine; never create another source request.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Wallet,parseEther,formatEther,keccak256} from 'ethers';
import {LiveV3} from '../server/live-v3.mjs';
if(!process.argv.includes('--send-testnet'))throw Error('Explicit --send-testnet required');
const journal='deployments/v3-attack-demo.local.json',artifact='artifacts/v3-attack-demo.json',recovery='deployments/demo-recovery.local.json',base='http://127.0.0.1:5173';
if(existsSync(recovery))throw Error('Recovery journal exists. Inspect it; automatic replay is disabled.');
const report=JSON.parse(readFileSync(journal,'utf8')),live=new LiveV3();
assert.equal(report.status,'stopped');assert.ok(report.messageKey);
const save=()=>{const s=JSON.stringify(report,null,2);writeFileSync(journal,s);writeFileSync(artifact,s);};
async function state(){const r=await fetch(base+'/api/live/state?refresh=1');if(!r.ok)throw Error('State unavailable');return r.json();}
async function action(label,input){const s=await state(),requestId=randomUUID(),op={label,requestId,input};report.operations.push(op);save();const r=await fetch(base+'/api/live/action',{method:'POST',headers:{Origin:base,'Content-Type':'application/json','X-Airlock-Control':s.controlToken,'X-Request-Id':requestId},body:JSON.stringify(input)});const job=await r.json();if(!r.ok)throw Error(job.error);for(let i=0;i<90;i++){const jobs=await(await fetch(base+'/api/live/jobs')).json();Object.assign(op,jobs.jobs.find(j=>j.id===job.id));save();if(op.status==='finalized')return;if(['failed','uncertain'].includes(op.status))throw Error(op.error);await new Promise(r=>setTimeout(r,2000));}throw Error('Inspect pending recovery job');}
try{
 const api=await live.connect();await live.assertIdentity(api);const before=await state();assert.equal(before.busy,false);assert.equal(before.messages.find(m=>m.key===report.messageKey)?.status,'queued');
 const wallet=new Wallet(JSON.parse(readFileSync('deployments/relay-wallet.local.json','utf8')).privateKey,live.rpc);assert.equal(wallet.address.toLowerCase(),live.plan.relay.toLowerCase());
 const value=parseEther('3');const gasPrice=BigInt(await live.rpc.send('eth_gasPrice',[]));const gasLimit=(await live.rpc.estimateGas({from:wallet.address,to:live.plan.guardianEvm,value}))*110n/100n;
 assert.ok(gasPrice*gasLimit<parseEther('0.1'));assert.ok(await live.rpc.getBalance(wallet.address)>value+gasPrice*gasLimit+parseEther('0.1'));
 const signed=await wallet.signTransaction({to:live.plan.guardianEvm,value,gasPrice,gasLimit,type:0,chainId:420420777,nonce:await live.rpc.getTransactionCount(wallet.address,'pending')});
 const op={label:'Return relay surplus to guardian for pause storage',input:{action:'returnRelaySurplus'},amount:'3',transactionHash:keccak256(signed),status:'signed'};report.operations.push(op);writeFileSync(recovery,JSON.stringify(op,null,2));save();
 await live.rpc.broadcastTransaction(signed);const receipt=await live.rpc.waitForTransaction(op.transactionHash,1,120000);assert.equal(receipt.status,1);await live.waitFinalized(api,receipt.blockNumber);assert.equal((await live.rpc.getBlock(receipt.blockNumber)).hash,receipt.blockHash);op.status='finalized';op.blockNumber=receipt.blockNumber;writeFileSync(recovery,JSON.stringify(op,null,2));save();
 report.initialError=report.error;delete report.error;report.status='guardian-response';save();
 await action('Guardian pause after storage budget recovery',{action:'pause'});const paused=await state();delete paused.controlToken;assert.equal(paused.paused,true);report.paused=paused;save();
 await action('Guardian cancels the quarantined request',{action:'cancel',key:report.messageKey});const after=await state();delete after.controlToken;assert.equal(after.messages.find(m=>m.key===report.messageKey)?.status,'cancelled');assert.equal(after.balance,report.before.balance);assert.equal(after.reserved,'0.0');assert.equal(after.paused,true);
 report.after=after;report.metrics={earlierNormalPayout:report.baseline.input.amount,requested:'4',paidDuringDemo:'0',cancelled:'4',vaultBefore:report.before.balance,vaultAfter:after.balance};report.status='completed';report.completedAt=new Date().toISOString();report.recoveryNote='Initial pause preflight rejected before signing: insufficient guardian storage funds. Returned 3 tPOT relay surplus to guardian, then finalized pause and cancel. Preflight now reserves the peak pause deposit.';save();console.log(JSON.stringify({status:report.status,metrics:report.metrics,guardian:after.guardianBalance,relay:after.relayBalance}));
}catch(e){report.status='stopped';report.error=e.message;save();console.error(e.message);process.exitCode=1;}finally{await live.api?.disconnect();live.rpc.destroy();}
