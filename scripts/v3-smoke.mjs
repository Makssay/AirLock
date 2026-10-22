import {ApiPromise,WsProvider} from '@polkadot/api';
import {Keyring} from '@polkadot/keyring';
import {cryptoWaitReady} from '@polkadot/util-crypto';
import {FetchRequest,JsonRpcProvider,Wallet,Contract,Interface,id,keccak256} from 'ethers';
import {parseEnv} from 'node:util';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';

const GENESIS='0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd';
const U=10n**18n;
const reportPath='deployments/v3-smoke.local.json';
let api,ws,rpc,guardian;
const report={network:'Portaldot V3 testnet',genesis:GENESIS,startedAt:new Date().toISOString(),checks:[],receipts:[],completed:false};
const save=()=>writeFileSync(reportPath,JSON.stringify(report,null,2));
try{
 if(!process.argv.includes('--send-testnet'))throw Error('Explicit --send-testnet required');
 if(existsSync(reportPath)){const previous=JSON.parse(readFileSync(reportPath));if(!process.argv.includes('--resume-empty')||previous.pending||previous.receipts.length)throw Error('A smoke-test journal exists. Inspect it before resuming; no automatic replay.');}
 const deployment=JSON.parse(readFileSync('deployments/airlock-v3.local.json','utf8'));
 const plan=JSON.parse(readFileSync('deployments/v3-preparation.local.json','utf8'));
 if(deployment.genesis!==GENESIS||deployment.portaldotDeployment!==true)throw Error('Expected a verified V3 deployment');
 const env=parseEnv(readFileSync('.env','utf8'));await cryptoWaitReady();
 try{guardian=new Keyring({type:'sr25519',ss58Format:42}).addFromUri(env.SEED.trim());}catch{throw Error('Cannot open guardian seed');}finally{delete env.SEED;}
 if(guardian.address!==plan.guardian)throw Error('Wrong guardian');
 ws=new WsProvider(plan.network.substrateRpc,false);await ws.connect();api=await ApiPromise.create({provider:ws,throwOnConnect:true});
 if(api.genesisHash.toHex()!==GENESIS||api.consts.revive.chainId.toString()!=='420420777')throw Error('Wrong network');
 const request=new FetchRequest(plan.network.evmRpc);request.setHeader('User-Agent','Airlock-testnet-smoke');request.timeout=20000;
 rpc=new JsonRpcProvider(request,undefined,{batchMaxCount:1});rpc.pollingInterval=1000;
 assert.equal(await rpc.send('eth_chainId',[]),'0x190f1ca9');
 const relayFile=JSON.parse(readFileSync('deployments/relay-wallet.local.json','utf8'));
 let relay;try{relay=new Wallet(relayFile.privateKey,rpc);}catch{throw Error('Cannot open the local test relay key');}finally{delete relayFile.privateKey;}
 assert.equal(relay.address.toLowerCase(),plan.relay.toLowerCase());
 const artifact=JSON.parse(readFileSync('artifacts/evm/Airlock.json','utf8'));
 const iface=new Interface(artifact.abi),c=new Contract(deployment.contract,artifact.abi,relay);
 assert.equal((await c.guardian()).toLowerCase(),plan.guardianEvm.toLowerCase());assert.equal((await c.relay()).toLowerCase(),relay.address.toLowerCase());assert.equal(await c.paused(),false);
 let block=await rpc.getBlock('latest');
 while(600-(block.timestamp%600)<180){console.log('Waiting for sufficient time in one release window; no test transaction sent.');await new Promise(resolve=>setTimeout(resolve,15000));block=await rpc.getBlock('latest');}
 report.contract=deployment.contract;report.guardian=plan.guardianEvm;report.relay=relay.address;report.domain=id('airlock:external-testnet:v1');save();
 async function finalizedEth(hash){
  const receipt=await rpc.waitForTransaction(hash,1,120000);assert.equal(receipt.status,1,'EVM transaction reverted');
  const deadline=Date.now()+120000;
  while(Date.now()<deadline){
   const at=await api.rpc.chain.getHeader(await api.rpc.chain.getFinalizedHead());
   if(BigInt(at.number.toString())>=BigInt(receipt.blockNumber)){
    const canonical=await rpc.getBlock(receipt.blockNumber);assert.equal(canonical.hash,receipt.blockHash);
    return {transactionHash:hash,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash,status:1,gasUsed:receipt.gasUsed.toString(),events:receipt.logs.map(l=>{try{return iface.parseLog(l)?.name;}catch{return null;}}).filter(Boolean)};
   }
   await new Promise(resolve=>setTimeout(resolve,1500));
  }
  throw Error('Transaction mined but finality not yet observed; inspect journal');
 }
 async function relaySend(label,method,args){
  const data=iface.encodeFunctionData(method,args);const gasPrice=BigInt(await rpc.send('eth_gasPrice',[]));
  const gas=await rpc.estimateGas({from:relay.address,to:deployment.contract,data});const gasLimit=gas*120n/100n;
  if(gasPrice*gasLimit>25n*U)throw Error('Relay transaction exceeds 25 tPOT fee limit');
  const tx=await relay.sendTransaction({to:deployment.contract,data,type:0,gasPrice,gasLimit});
  report.pending={label,transactionHash:tx.hash};save();
  const receipt=await finalizedEth(tx.hash);report.receipts.push({label,...receipt});delete report.pending;save();console.log(JSON.stringify({label,hash:tx.hash,block:receipt.blockNumber}));return receipt;
 }
 async function guardianSend(label,method,args=[]){
  const data=iface.encodeFunctionData(method,args);
  const dry=await api.call.reviveApi.call(guardian.address,deployment.contract,0,null,null,data);
  if(dry.result.isErr)throw Error('Guardian dry-run failed');
  if((Number(dry.toJSON().result.ok.flags.bits)&1)!==0)throw Error('Guardian call reverted in dry-run');
  const weight={refTime:(BigInt(dry.weightRequired.refTime.toString())*125n/100n).toString(),proofSize:(BigInt(dry.weightRequired.proofSize.toString())*125n/100n).toString()};
  const charge=dry.storageDeposit.isCharge?BigInt(dry.storageDeposit.asCharge.toString()):0n;
  const tx=api.tx.revive.call(deployment.contract,0,weight,(charge+10n**14n).toString(),data);
  const fee=await tx.paymentInfo(guardian);if(BigInt(fee.partialFee.toString())>1n*10n**14n)throw Error('Guardian fee exceeds 1 tPOT');
  await tx.signAsync(guardian,{nonce:-1});report.pending={label,transactionHash:tx.hash.toHex()};save();
  const result=await new Promise((resolve,reject)=>{
   let unsub,done=false;const timer=setTimeout(()=>finish(Error('Guardian transaction timeout; inspect journal')),180000);
   function finish(error,value){if(done)return;done=true;clearTimeout(timer);unsub?.();error?reject(error):resolve(value);}
   tx.send(({status,dispatchError,events})=>{if(!status.isFinalized)return;if(dispatchError)return finish(Error('Guardian dispatch failed'));finish(null,{transactionHash:tx.hash.toHex(),blockHash:status.asFinalized.toHex(),status:1,events:events.map(e=>e.event.section+'.'+e.event.method)});}).then(u=>{unsub=u;if(done)u();}).catch(()=>finish(Error('Guardian submission failed; inspect journal')));
  });
  report.receipts.push({label,...result});delete report.pending;save();console.log(JSON.stringify({label,hash:result.transactionHash}));
 }
 const domain=report.domain,recipient=plan.guardianEvm;
 const first=BigInt(Date.now());report.firstNonce=first.toString();
 await relaySend('normal release','submit',[domain,first,recipient,U]);
 assert.equal((await c.messages(await c.messageId(domain,first))).status,2n);report.checks.push('normal release finalized');save();
 const queued=[];
 assert.equal(await c.spentThisWindow(),U);report.checks.push('window budget recorded the 1 tPOT release');save();
 await relaySend('large request quarantined','submit',[domain,first+7n,recipient,4n*U]);
 const large=await c.messageId(domain,first+7n);assert.equal((await c.messages(large)).status,1n);queued.push(large);
 async function rejected(name,method,args,error){let actual;try{await c[method].staticCall(...args);}catch(e){actual=e.revert?.name;try{actual||=iface.parseError(e.data)?.name;}catch{}}assert.equal(actual,error,name);report.checks.push(name);save();}
 await rejected('oversized drain rejected','submit',[domain,first+8n,recipient,40n*U],'InvalidMessage');
 await rejected('nonce replay rejected','submit',[domain,first,recipient,U],'Replay');
 await rejected('early queued release rejected','execute',[large],'TooEarly');
 await guardianSend('guardian pause','pause');assert.equal(await c.paused(),true);
 await rejected('releases blocked while paused','submit',[domain,first+9n,recipient,U],'Paused');
 for(const key of queued)await guardianSend('guardian cancels queued release','cancel',[key]);
 assert.equal(await c.reserved(),0n);for(const key of queued)assert.equal((await c.messages(key)).status,3n);
 const balance=BigInt(await rpc.send('eth_getBalance',[deployment.contract,'latest']));assert.equal(balance,49n*U);
 report.checks.push('guardian pause and cancellation finalized','vault retained 49 tPOT; queue reservations cleared');
 report.vaultBalanceBaseUnits=balance.toString();report.amountDecimals=18;report.reserved='0';report.paused=true;report.completed=true;report.completedAt=new Date().toISOString();save();
 writeFileSync('artifacts/v3-live-evidence.json',JSON.stringify({...report,portaldotDeployment:true},null,2));
 console.log(JSON.stringify({completed:true,contract:deployment.contract,checks:report.checks.length,transactions:report.receipts.length,vaultTPOT:49,paused:true}));
}catch(e){report.error=e.shortMessage||e.message;if(report.contract)save();console.error(report.error);process.exitCode=1;}
finally{guardian?.lock();await api?.disconnect();if(!api)await ws?.disconnect();rpc?.destroy();}
