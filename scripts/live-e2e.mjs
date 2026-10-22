import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {parseEther} from 'ethers';
if(!process.argv.includes('--send-testnet'))throw Error('Explicit --send-testnet required');
const base='http://127.0.0.1:5173';
const file='deployments/v3-console-e2e.local.json';
const report=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{startedAt:new Date().toISOString(),requests:{},operations:[],checks:[]};
const save=()=>writeFileSync(file,JSON.stringify(report,null,2));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function state(){const response=await fetch(base+'/api/live/state?refresh=1',{signal:AbortSignal.timeout(45000)});const data=await response.json();if(!response.ok)throw Error(data.error);return data;}
async function action(label,input){
 const s=await state();const old=s.jobs.find(j=>j.requestId===report.requests[label]);if(old?.status==='failed'&&!old.transactionHash&&!old.source?.transactionHash)delete report.requests[label];
 const requestId=report.requests[label]||(report.requests[label]=randomUUID());save();
 const response=await fetch(base+'/api/live/action',{method:'POST',headers:{'Content-Type':'application/json','Origin':base,'X-Airlock-Control':s.controlToken,'X-Request-Id':requestId},body:JSON.stringify(input)});
 const job=await response.json();if(!response.ok)throw Error(job.error);
 const deadline=Date.now()+480000;
 while(Date.now()<deadline){const jobs=await(await fetch(base+'/api/live/jobs')).json();const current=jobs.jobs.find(j=>j.id===job.id);if(['finalized','checked'].includes(current.status)){if(!report.operations.some(j=>j.id===current.id))report.operations.push(current);save();console.log(JSON.stringify({label,status:current.status,transactionHash:current.transactionHash,sourceHash:current.source?.transactionHash}));return current;}if(['failed','uncertain'].includes(current.status))throw Error(current.error);await sleep(3000);}
 throw Error('Operation is still pending. Resume using the saved request IDs, do not create new ones.');
}
try{
 const denied=await fetch(base+'/api/live/action',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://example.com'},body:JSON.stringify({action:'pause'})});assert.equal(denied.status,403);report.checks.push('cross-origin signing request rejected');
 let s=await state();assert.equal(s.mode,'portaldot-v3-testnet');assert.equal(s.chainId,420420777);assert.ok(s.sourceConfig?.contract);
 if(s.paused){
  if(!s.pendingPolicy)await action('schedule resume',{action:'policy',instant:'1',cap:'5',maxPending:'20',delaySeconds:120,resume:true});
  do{s=await state();if(s.pendingPolicy&&s.now<s.pendingPolicy.eligibleAt){console.log('Waiting for the on-chain guardian policy delay.');await sleep(15000);}else break;}while(true);
  await action('activate resume',{action:'activatePolicy'});
 }
 s=await state();assert.equal(s.paused,false);
 if(Number(s.relayBalance)<12)await action('fund relay',{action:'fundRelay'});
 s=await state();report.beforeVault=report.beforeVault||s.balance;save();
 const payout=await action('Sepolia to V3 release',{action:'submit',amount:'0.25'});
 assert.equal(payout.status,'finalized');assert.equal(payout.source.chainId,11155111);assert.equal(payout.source.requiredConfirmations,6);assert.equal(payout.source.status,'six confirmations verified');
 report.checks.push('Sepolia event verified after six canonical confirmations','V3 relay transaction finalized');
 s=await state();assert.equal(parseEther(s.balance),parseEther(report.beforeVault)-parseEther('0.25'));const message=s.messages.find(m=>m.nonce===payout.nonce);assert.ok(message);assert.equal(message.status,'released');assert.equal(message.amount,'0.25');
 report.checks.push('live vault changed by exactly 0.25 tPOT','source-derived nonce maps to released V3 message');
 const checks=await action('read-only attack checks',{action:'checkAttack'});assert.ok(checks.checks.every(c=>c.result==='rejected'));report.checks.push('oversize, domain and replay checks rejected by deployed contract');
 const retry=await action('read-only attack checks',{action:'checkAttack'});assert.equal(retry.id,checks.id);report.checks.push('duplicate request ID did not create another operation');
 delete s.controlToken;report.finalState=s;report.completed=true;report.completedAt=new Date().toISOString();report.limitations='Trusted RPC relay; six Sepolia confirmations are not an Ethereum finalized checkpoint or consensus proof. Outbox emits requests; it does not escrow ETH.';save();writeFileSync('artifacts/v3-console-e2e.json',JSON.stringify(report,null,2));console.log(JSON.stringify({completed:true,vault:s.balance,source:s.sourceConfig.contract,contract:s.contract,checks:report.checks.length}));
}catch(e){report.error=e.message;save();console.error(e.message);process.exitCode=1;}
