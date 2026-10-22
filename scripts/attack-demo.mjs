import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {parseEther} from 'ethers';
if(!process.argv.includes('--send-testnet'))throw Error('Use --send-testnet to run the controlled public testnet demo');
const base='http://127.0.0.1:5173',journal='deployments/v3-attack-demo.local.json',artifact='artifacts/v3-attack-demo.json';
if(existsSync(journal))throw Error('Demo journal already exists. Inspect its transactions; automatic replay is disabled.');
const report={startedAt:new Date().toISOString(),status:'preflight',operations:[],limitations:'Controlled 4 tPOT request to the guardian, modelling an untrusted relay instruction. Trusted RPC relay, six source confirmations; no Ethereum consensus proof. The normal payout is a separately recorded earlier run. Cancelled amount is not a measurement of total loss avoided.'};
const save=()=>{const text=JSON.stringify(report,null,2);writeFileSync(journal,text);writeFileSync(artifact,text);};
async function get(path){const r=await fetch(base+path,{signal:AbortSignal.timeout(45000)});const s=await r.json();if(!r.ok)throw Error(s.error);return s;}
async function state(){const s=await get('/api/live/state?refresh=1');delete s.controlToken;return s;}
async function action(label,input){
 const s=await get('/api/live/state?refresh=1'),requestId=randomUUID();
 const operation={label,requestId,input,status:'requested'};report.operations.push(operation);save();
 const r=await fetch(base+'/api/live/action',{method:'POST',headers:{'Content-Type':'application/json',Origin:base,'X-Airlock-Control':s.controlToken,'X-Request-Id':requestId},body:JSON.stringify(input)});
 const job=await r.json();if(!r.ok)throw Error(job.error);
 const deadline=Date.now()+480000;
 while(Date.now()<deadline){const current=(await get('/api/live/jobs')).jobs.find(j=>j.id===job.id);Object.assign(operation,current);save();
  if(['finalized','checked'].includes(current.status)){console.log(JSON.stringify({step:label,status:current.status,hash:current.transactionHash}));return current;}
  if(['failed','uncertain'].includes(current.status))throw Error(current.error||current.status);
  await new Promise(resolve=>setTimeout(resolve,3000));
 }
 throw Error('Timeout: inspect the saved job before any further transaction');
}
try{
 const quote=await get('/api/live/demo-quote');assert.equal(quote.ready,true,quote.reason);report.quote=quote;
 const before=await state();assert.equal(before.chainId,420420777);assert.equal(before.paused,false);assert.equal(before.reserved,'0.0');report.before=before;
 const baseline=before.jobs.find(j=>j.status==='finalized'&&j.input.action==='submit'&&j.source&&before.messages.some(m=>m.nonce===j.nonce&&m.status==='released'));
 assert.ok(baseline,'A confirmed normal cross-testnet payout is required');report.baseline=baseline;save();
 if(quote.topup!=='0')await action('Budgeted relay top-up',{action:'fundRelay',amount:quote.topup});
 const refreshed=await get('/api/live/demo-quote');assert.equal(refreshed.ready,true);assert.equal(refreshed.topup,'0');
 report.status='quarantining';save();const submission=await action('Controlled oversized-for-instant request',{action:'submit',amount:'4'});
 const queued=await state(),message=queued.messages.find(m=>m.nonce===submission.nonce);assert.equal(message?.status,'queued');assert.equal(message.amount,'4.0');assert.equal(queued.balance,before.balance);assert.equal(parseEther(queued.reserved),4n*10n**18n);report.messageKey=message.key;report.quarantined=queued;save();
 report.status='guardian-response';save();await action('Guardian emergency pause',{action:'pause'});
 const paused=await state();assert.equal(paused.paused,true);report.paused=paused;save();
 await action('Guardian cancels the quarantined request',{action:'cancel',key:message.key});
 const after=await state();assert.equal(after.messages.find(m=>m.key===message.key)?.status,'cancelled');assert.equal(after.balance,before.balance);assert.equal(after.reserved,'0.0');assert.equal(after.paused,true);
 report.after=after;report.metrics={earlierNormalPayout:baseline.input.amount,requested:'4',paidDuringDemo:'0',cancelled:'4',vaultBefore:before.balance,vaultAfter:after.balance};
 report.status='completed';report.completedAt=new Date().toISOString();save();console.log(JSON.stringify({status:report.status,metrics:report.metrics}));
}catch(e){report.status='stopped';report.error=e.message;save();console.error(e.message);process.exitCode=1;}
