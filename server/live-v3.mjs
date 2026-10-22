import {ApiPromise,WsProvider,Keyring} from '@polkadot/api';
import {cryptoWaitReady} from '@polkadot/util-crypto';
import {FetchRequest,JsonRpcProvider,Contract,Interface,Wallet,parseEther,formatEther,id} from 'ethers';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {randomUUID} from 'node:crypto';
import {matchesV3Code} from '../lib/v3-code.mjs';
import {createSourceRequest,sourceConfig} from './source-lane.mjs';

export const V3_GENESIS='0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd';
export const V3_CONTRACT='0x3bbb62bf86d40f26a87e70fe56ee073e69198713';
const GUARDIAN='5HKTe2e7hXWUN6gfreN9dMGQ3TBjqeVbkMzFAFpCaxfvXnQZ';
const RPC='https://test-evm-rpc-v3.portaldot.dev',WS='wss://test-node-v3.portaldot.dev';
const N=10n**14n,U=10n**18n;
const file='deployments/v3-console.local.json';
const json=value=>JSON.stringify(value,(_k,v)=>typeof v==='bigint'?v.toString():v,2);

export function validateLiveAction(body){
 const allowed=['submit','pause','cancel','execute','policy','activatePolicy','cancelPolicy','checkAttack','fundRelay'];
 if(!allowed.includes(body?.action))throw Error('Unsupported V3 action');
 const result={action:body.action};
 if(body.action==='fundRelay'){const amount=body.amount??'5';if(typeof amount!=='string'||!/^[1-5]$/.test(amount))throw Error('Relay funding must be between 1 and 5 tPOT');result.amount=amount;}
 if(['cancel','execute'].includes(body.action)){if(!/^0x[0-9a-f]{64}$/i.test(body.key||''))throw Error('Invalid message ID');result.key=body.key;}
 if(body.action==='submit'){
  if(typeof body.amount!=='string'||!/^\d{1,2}(\.\d{1,4})?$/.test(body.amount))throw Error('Use a positive amount with at most four decimals');
  const amount=parseEther(body.amount);if(amount<=0n||amount>5n*U)throw Error('This test console limits each request to 5 tPOT');result.amount=body.amount;
 }
 if(body.action==='policy'){
  for(const key of ['instant','cap','maxPending']){if(typeof body[key]!=='string'||!/^\d{1,2}(\.\d{1,4})?$/.test(body[key]))throw Error('Invalid policy amount');result[key]=body[key];}
  if(parseEther(result.instant)<=0n||parseEther(result.cap)<parseEther(result.instant)||parseEther(result.cap)>5n*U||parseEther(result.maxPending)<=0n||parseEther(result.maxPending)>20n*U)throw Error('Test policy must keep instant <= cap <= 5 and maximum pending <= 20 tPOT');
  const delay=Number(body.delaySeconds);if(!Number.isInteger(delay)||delay<120||delay>3600)throw Error('Quarantine must be between 120 and 3600 seconds');result.delaySeconds=delay;
  if(typeof body.resume!=='boolean')throw Error('Explicit resume choice required');result.resume=body.resume;
 }
 return result;
}

export class LiveV3 {
 constructor(){
  mkdirSync('deployments',{recursive:true});
  this.artifact=JSON.parse(readFileSync('artifacts/evm/Airlock.json','utf8'));this.iface=new Interface(this.artifact.abi);
  this.plan=existsSync('deployments/v3-preparation.local.json')?JSON.parse(readFileSync('deployments/v3-preparation.local.json','utf8')):{guardianEvm:JSON.parse(readFileSync('artifacts/v3-live-evidence.json','utf8')).guardian,relay:JSON.parse(readFileSync('artifacts/v3-live-evidence.json','utf8')).relay,dryRun:{result:{ok:{result:{data:readFileSync('artifacts/v3-deployed-runtime.hex','utf8').trim()}}}}};
  const request=new FetchRequest(RPC);request.setHeader('User-Agent','Airlock-local-testnet-console');request.timeout=20000;
  this.rpc=new JsonRpcProvider(request,undefined,{batchMaxCount:1});this.rpc.pollingInterval=1500;
  this.contract=new Contract(V3_CONTRACT,this.artifact.abi,this.rpc);
  this.store=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{jobs:[],messages:{},logs:[],cursor:146536};
  if(!existsSync(file)&&existsSync('artifacts/v3-console-e2e.json')){const history=JSON.parse(readFileSync('artifacts/v3-console-e2e.json','utf8')).finalState;this.store.jobs=history.jobs;this.store.logs=history.logs;this.store.cursor=history.finalizedBlock;for(const message of history.messages)this.store.messages[message.key]={...message};}
  this.busy=false;this.running=new Set();this.snapshotPromise=null;this.cached=null;this.cacheTime=0;this.connectPromise=null;
  for(const job of this.store.jobs)if(job.status==='checking'){job.status='failed';job.error='Server restarted before signing; no transaction was broadcast.';}
  if(existsSync('deployments/v3-smoke.local.json')){const smoke=JSON.parse(readFileSync('deployments/v3-smoke.local.json','utf8'));if(smoke.firstNonce){for(const offset of [0n,7n]){const nonce=BigInt(smoke.firstNonce)+offset;const key=this.iface.encodeFunctionData('messageId',[id('airlock:external-testnet:v1'),nonce]);this.store.messages['nonce:'+nonce]={nonce:nonce.toString(),lookupData:key};}}}
 }
 save(){writeFileSync(file,json(this.store));}
 async connect(){
  if(this.api?.isConnected)return this.api;
  if(!this.connectPromise)this.connectPromise=(async()=>{const provider=new WsProvider(WS,false);let timer;try{const api=await Promise.race([(async()=>{await provider.connect();return ApiPromise.create({provider,throwOnConnect:true});})(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('V3 connection timed out')),30000);})]);if(api.genesisHash.toHex()!==V3_GENESIS||api.consts.revive.chainId.toString()!=='420420777'){await api.disconnect();throw Error('Wrong network: signing disabled');}this.api=api;return api;}catch(e){await provider.disconnect();throw e;}finally{clearTimeout(timer);this.connectPromise=null;}})();
  return this.connectPromise;
 }
 async assertIdentity(api){
  if(api.genesisHash.toHex()!==V3_GENESIS||String(api.consts.revive.chainId)!=='420420777'||await this.rpc.send('eth_chainId',[])!=='0x190f1ca9')throw Error('Network identity mismatch');
  const code=await api.call.reviveApi.code(V3_CONTRACT);
  if(!matchesV3Code(code.toU8a(true),this.plan.dryRun.result.ok.result.data))throw Error('Deployed code mismatch; signing disabled');
  if((await this.contract.guardian()).toLowerCase()!==this.plan.guardianEvm.toLowerCase()||(await this.contract.relay()).toLowerCase()!==this.plan.relay.toLowerCase())throw Error('Contract role mismatch');
 }
 async syncLogs(height){
  for(let from=this.store.cursor+1;from<=height;from+=500){
   const end=Math.min(height,from+499);const logs=await this.rpc.getLogs({address:V3_CONTRACT,fromBlock:from,toBlock:end});
   for(const log of logs){let event;try{event=this.iface.parseLog(log);}catch{continue;}if(!event)continue;
    const key=event.args.id;
    if(key&&['Queued','Released','Cancelled'].includes(event.name)){const old=this.store.messages[key]||{};this.store.messages[key]={...old,key,recipient:event.args.recipient||old.recipient,amount:event.args.amount?.toString()||old.amount,firstSeenBlock:old.firstSeenBlock||log.blockNumber};}
    this.store.logs.push({event:event.name,transactionHash:log.transactionHash,blockHash:log.blockHash,blockNumber:log.blockNumber,key:key||null});
   }
   this.store.cursor=end;this.store.logs=this.store.logs.slice(-300);this.save();
  }
 }
 async snapshot(force=false){
  if(!force&&this.cached&&Date.now()-this.cacheTime<10000)return {...this.cached,jobs:this.store.jobs.toReversed(),busy:this.busy||this.store.jobs.some(j=>['signed','submitted','included','uncertain'].includes(j.status))};
  if(this.snapshotPromise)return this.snapshotPromise;
  this.snapshotPromise=this.readSnapshot().then(value=>{this.cached=value;this.cacheTime=Date.now();return value;}).finally(()=>{this.snapshotPromise=null;});return this.snapshotPromise;
 }
 async readSnapshot(){
  const api=await this.connect();await this.assertIdentity(api);
  const finalizedHash=await api.rpc.chain.getFinalizedHead();const nativeHeader=await api.rpc.chain.getHeader(finalizedHash);const height=Number(nativeHeader.number.toString());
  const block=await this.rpc.getBlock(height);if(!block)throw Error('Ethereum gateway has not indexed the finalized block yet');const opts={blockTag:height};
  let historyError=null;try{await this.syncLogs(height);}catch{historyError='History sync is incomplete. Displayed messages are verified, but some earlier events may be missing.';}
  const [policy,plan,paused,reserved,spent,balance,floor,window,policyDelay,guardianBalance,relayBalance]=await Promise.all([this.contract.policy(opts),this.contract.pendingPolicy(opts),this.contract.paused(opts),this.contract.reserved(opts),this.contract.spentThisWindow(opts),this.rpc.getBalance(V3_CONTRACT,height),this.contract.reserveFloor(opts),this.contract.windowSeconds(opts),this.contract.policyDelaySeconds(opts),this.rpc.getBalance(this.plan.guardianEvm,height),this.rpc.getBalance(this.plan.relay,height)]);
  const messages=[];
  for(const [key,value] of Object.entries(this.store.messages)){
   if(key.startsWith('nonce:')){const actual=await this.contract.messageId(id('airlock:external-testnet:v1'),value.nonce,opts);if(this.store.messages[actual])this.store.messages[actual].nonce=value.nonce;continue;}
   const m=await this.contract.messages(key,opts);if(m.status===0n)continue;
   messages.push({key,nonce:value.nonce||null,recipient:m.recipient,amount:formatEther(m.amount),status:['missing','queued','released','cancelled'][Number(m.status)],eligibleAt:Number(m.eligibleAt)*1000,firstSeenBlock:value.firstSeenBlock,transactionHash:this.store.logs.find(l=>l.key===key)?.transactionHash});
  }
  const unfinished=this.store.jobs.find(j=>['signed','submitted','included','uncertain'].includes(j.status));
  const capability=existsSync('.env')&&existsSync('deployments/relay-wallet.local.json');
  const pending=plan.exists?{instant:formatEther(plan.policy.instant),cap:formatEther(plan.policy.cap),delaySeconds:Number(plan.policy.delaySeconds),maxPending:formatEther(plan.policy.maxPending),eligibleAt:Number(plan.eligibleAt)*1000,resume:plan.resume}:null;
  return {mode:'portaldot-v3-testnet',contract:V3_CONTRACT,chainId:420420777,genesis:V3_GENESIS,finalizedBlock:height,finalizedHash:finalizedHash.toHex(),checkedAt:new Date().toISOString(),now:block.timestamp*1000,balance:formatEther(balance),reserved:formatEther(reserved),spent:formatEther(spent),reserveFloor:formatEther(floor),windowSeconds:Number(window),policyDelaySeconds:Number(policyDelay),paused,policy:{instant:formatEther(policy.instant),cap:formatEther(policy.cap),delaySeconds:Number(policy.delaySeconds),maxPending:formatEther(policy.maxPending)},pendingPolicy:pending,guardian:this.plan.guardianEvm,relay:this.plan.relay,guardianBalance:formatEther(guardianBalance),relayBalance:formatEther(relayBalance),messages:messages.toReversed(),logs:this.store.logs.toReversed(),jobs:this.store.jobs.toReversed(),busy:this.busy||!!unfinished,canSign:capability&&!unfinished,signingAvailable:capability,historyError,sourceConfig:sourceConfig(),source:sourceConfig()?'Sepolia event → trusted RPC relay → V3; six confirmations, not a consensus proof':'Direct V3 testnet relay requests; no external-chain proof'};
 }
 start(body,requestId){
  const input=validateLiveAction(body);
  if(typeof requestId!=='string'||!/^[-a-z0-9]{16,80}$/i.test(requestId))throw Error('A unique request ID is required');
  const old=this.store.jobs.find(j=>j.requestId===requestId);if(old)return old;
  const active=this.store.jobs.filter(j=>['checking','signed','submitted','included','uncertain'].includes(j.status));
  const emergencyPause=input.action==='pause'&&active.every(j=>j.input.action==='submit');
  if((this.busy||active.length)&&!emergencyPause)throw Error('Another transaction is pending. Inspect it before sending another.');
  const job={id:randomUUID(),requestId,input,createdAt:new Date().toISOString(),status:'checking'};this.store.jobs.push(job);this.save();this.running ||=new Set();this.running.add(job.id);this.busy=true;
  setImmediate(()=>this.run(job).catch(e=>{job.status=job.transactionHash||job.source?.transactionHash?'uncertain':'failed';job.error=e.safeMessage||e.shortMessage||'V3 operation failed. Check the journal before retrying.';if(e.message?.startsWith('Limit:')||e.message?.startsWith('Contract:'))job.error=e.message;this.save();}).finally(()=>{this.running.delete(job.id);this.busy=this.running.size>0;this.cacheTime=0;}));
  return job;
 }
 errorName(error){try{return error.revert?.name||this.iface.parseError(error.data)?.name||'RPC error';}catch{return 'RPC error';}}
 async checks(job){
  const nonce=BigInt(Date.now());const domain=await this.contract.sourceDomain();const recipient=this.plan.guardianEvm;
  const results=[];
  for(const [name,args] of [['oversized request',[domain,nonce,recipient,40n*U]],['wrong source domain',[id('airlock:wrong-domain'),nonce,recipient,U]]]){
   try{await this.contract.submit.staticCall(...args,{from:this.plan.relay});results.push({name,result:'accepted'});}catch(e){results.push({name,result:'rejected',reason:this.errorName(e)});}
  }
  const existing=Object.values(this.store.messages).find(m=>m.nonce&&m.key);
  if(existing){try{await this.contract.submit.staticCall(domain,existing.nonce,recipient,U,{from:this.plan.relay});results.push({name:'nonce replay',result:'accepted'});}catch(e){results.push({name:'nonce replay',result:'rejected',reason:this.errorName(e)});}}
  job.checks=results;job.status='checked';job.completedAt=new Date().toISOString();this.save();return job;
 }
 async run(job){
  const api=await this.connect();await this.assertIdentity(api);
  const {action}=job.input;if(action==='checkAttack')return this.checks(job);
  if(action==='submit')return this.sendRelay(job,api);
  return this.sendGuardian(job,api);
 }
 async sendRelay(job,api){
  if(await this.contract.paused())throw Error('Contract: releases are paused. Schedule and activate a resume policy first.');
  const amount=parseEther(job.input.amount),domain=await this.contract.sourceDomain();let nonce=BigInt(Date.now());
  let relay;try{relay=new Wallet(JSON.parse(readFileSync('deployments/relay-wallet.local.json','utf8')).privateKey,this.rpc);}catch{throw Error('Contract: local relay key is unavailable');}
  if(relay.address.toLowerCase()!==this.plan.relay.toLowerCase())throw Error('Contract: relay key mismatch');
  let data=this.iface.encodeFunctionData('submit',[domain,nonce,this.plan.guardianEvm,amount]);
  let gasPrice=BigInt(await this.rpc.send('eth_gasPrice',[])),estimated;
  try{estimated=await this.rpc.estimateGas({from:relay.address,to:V3_CONTRACT,data});}catch(e){throw Error('Contract: '+this.errorName(e));}
  let gasLimit=estimated*105n/100n,cost=gasPrice*gasLimit;
  if(cost>25n*U)throw Error('Limit: relay fee estimate exceeds 25 tPOT');
  if(await this.rpc.getBalance(relay.address)<cost+U/10n)throw Error('Limit: relay balance is too low for the estimated fee; top it up separately');
  if(sourceConfig()){
   nonce=await createSourceRequest(job,()=>this.save());
   if(await this.contract.paused())throw Error('Contract: guardian paused while waiting for source confirmations; source event saved, no payout submitted');
   data=this.iface.encodeFunctionData('submit',[domain,nonce,this.plan.guardianEvm,amount]);gasPrice=BigInt(await this.rpc.send('eth_gasPrice',[]));
   try{estimated=await this.rpc.estimateGas({from:relay.address,to:V3_CONTRACT,data});}catch(e){throw Error('Contract: '+this.errorName(e));}
   gasLimit=estimated*105n/100n;cost=gasPrice*gasLimit;
   if(cost>25n*U||await this.rpc.getBalance(relay.address)<cost+U/10n)throw Error('Limit: destination fee changed; source event saved, do not create another source request');
  }
  job.nonce=nonce.toString();job.amount=job.input.amount;job.recipient=this.plan.guardianEvm;job.estimatedMaxFee=formatEther(cost);
  const key=await this.contract.messageId(domain,nonce);this.store.messages[key]={key,nonce:nonce.toString(),recipient:job.recipient,amount:amount.toString()};
  const tx={to:V3_CONTRACT,data,type:0,gasPrice,gasLimit,chainId:420420777,nonce:await this.rpc.getTransactionCount(relay.address,'pending')};
  const signed=await relay.signTransaction(tx);job.transactionHash=(await import('ethers')).keccak256(signed);job.kind='ethereum';job.status='signed';this.save();
  await this.rpc.broadcastTransaction(signed);job.status='submitted';this.save();
  const receipt=await this.rpc.waitForTransaction(job.transactionHash,1,120000);
  if(!receipt)throw Error('Contract: transaction finality not yet observed');
  job.blockNumber=receipt.blockNumber;job.blockHash=receipt.blockHash;job.status='included';this.save();
  await this.waitFinalized(api,receipt.blockNumber);
  if((await this.rpc.getBlock(receipt.blockNumber)).hash!==receipt.blockHash)throw Error('Contract: receipt is not canonical');
  if(receipt.status!==1){job.status='failed';job.error='Transaction reverted; network fee still applies';}else job.status='finalized';
  job.completedAt=new Date().toISOString();this.save();
 }
 async guardianKey(){
  await cryptoWaitReady();let pair;try{const env=parseEnv(readFileSync('.env','utf8'));pair=new Keyring({type:'sr25519',ss58Format:42}).addFromUri(env.SEED.trim());delete env.SEED;}catch{throw Error('Contract: local guardian signing is unavailable');}
  if(pair.address!==GUARDIAN){pair.lock();throw Error('Contract: guardian seed does not match this deployment');}return pair;
 }
 async sendGuardian(job,api){
  const input=job.input;let method,args=[];
  if(input.action==='pause')method='pause';
  if(['cancel','execute'].includes(input.action)){method=input.action;args=[input.key];}
  if(input.action==='policy'){method='schedulePolicy';args=[[parseEther(input.instant),parseEther(input.cap),input.delaySeconds,parseEther(input.maxPending)],input.resume];}
  if(['activatePolicy','cancelPolicy'].includes(input.action))method=input.action;
  let pair;
  try{
   pair=await this.guardianKey();
   if(input.action==='fundRelay'){
    const relayBalance=await this.rpc.getBalance(this.plan.relay);if(relayBalance>=25n*U)throw Error('Limit: relay already has at least 25 tPOT');
    const native=(await api.call.reviveApi.accountId(this.plan.relay)).toString();
    const amount=BigInt(input.amount)*N;return await this.broadcastNative(job,api,pair,api.tx.balances.transferKeepAlive(native,amount.toString()),amount);
   }
   const data=this.iface.encodeFunctionData(method,args);const dry=await api.call.reviveApi.call(GUARDIAN,V3_CONTRACT,0,null,null,data);
   if(dry.result.isErr){let reason='runtime rejected call';if(dry.result.asErr.isModule){const e=api.registry.findMetaError(dry.result.asErr.asModule);reason=e.section+'.'+e.name;}throw Error('Contract: '+reason);}
   const output=dry.toJSON().result.ok;if((Number(output.flags.bits)&1)!==0){let reason='reverted';try{reason=this.iface.parseError(output.data)?.name||reason;}catch{}throw Error('Contract: '+reason);}
   const weight={refTime:(BigInt(dry.weightRequired.refTime.toString())*125n/100n).toString(),proofSize:(BigInt(dry.weightRequired.proofSize.toString())*125n/100n).toString()};
   const charge=dry.storageDeposit.isCharge?BigInt(dry.storageDeposit.asCharge.toString()):0n;
   if(charge>12n*N)throw Error('Limit: storage deposit exceeds 12 tPOT');
   const tx=api.tx.revive.call(V3_CONTRACT,0,weight,(charge+N).toString(),data);await this.broadcastNative(job,api,pair,tx,charge);
  }finally{pair?.lock();}
 }
 async broadcastNative(job,api,pair,tx,charge=0n){
   const fee=await tx.paymentInfo(pair);
   if(BigInt(fee.partialFee.toString())>N)throw Error('Limit: guardian network fee exceeds 1 tPOT');
   const account=await api.query.system.account(GUARDIAN);if(BigInt(account.data.free.toString())-BigInt(account.data.frozen.toString())<charge+BigInt(fee.partialFee.toString())*2n+N/10n)throw Error('Limit: guardian has insufficient funds for storage and fee margin');
   job.estimatedFeeNative=(BigInt(fee.partialFee.toString())+charge).toString();
   await tx.signAsync(pair,{nonce:-1});job.transactionHash=tx.hash.toHex();job.kind='substrate';job.status='signed';this.save();pair.lock();
   await new Promise((resolve,reject)=>{
    let unsub,done=false;const timer=setTimeout(()=>finish(Error('Contract: finalization timeout; inspect the transaction before retrying')),180000);
    const finish=(error)=>{if(done)return;done=true;clearTimeout(timer);unsub?.();error?reject(error):resolve();};
    tx.send(({status,dispatchError,events})=>{
     if(status.isInBlock){job.status='included';job.blockHash=status.asInBlock.toHex();this.save();}
     if(status.isInvalid||status.isDropped||status.isUsurped)return finish(Error('Contract: submission not finalized; inspect transaction'));
     if(!status.isFinalized)return;job.blockHash=status.asFinalized.toHex();
     if(dispatchError){job.status='failed';job.error='Runtime rejected transaction';}else job.status='finalized';job.events=events.map(({event})=>({section:event.section,method:event.method,data:event.data.toJSON()}));job.completedAt=new Date().toISOString();this.save();finish();
    }).then(u=>{unsub=u;if(done)u();}).catch(()=>finish(Error('Contract: submission failed; inspect the saved transaction')));
   });
 }
 async waitFinalized(api,height){const deadline=Date.now()+120000;while(Date.now()<deadline){const header=await api.rpc.chain.getHeader(await api.rpc.chain.getFinalizedHead());if(Number(header.number.toString())>=height)return;await new Promise(resolve=>setTimeout(resolve,1500));}throw Error('Contract: finality timeout; do not resubmit');}
}
