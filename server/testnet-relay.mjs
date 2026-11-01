import {parseEther,keccak256,Transaction} from 'ethers';
import {lane,rpcClient,readDestination,inspectSource,vaultInterface,sameAddress,validHash} from '../lib/testnet-lane.mjs';

// A single durable journal and a process lock serialize this dedicated testnet signer.
// Save signed bytes before broadcast. An unknown hash never permits replacement.
export class TestnetRelay {
 constructor({journal,save,wallet,rpc=rpcClient(lane.destinationRpc),sourceRpc=rpcClient(lane.sourceRpc),native=rpcClient(lane.nativeRpc),read=readDestination,inspect=inspectSource,now=Date.now,expectedRelay=lane.relay}){
  Object.assign(this,{journal,save,wallet,rpc,sourceRpc,native,read,inspect,now,expectedRelay});
  if(!sameAddress(wallet.address,expectedRelay))throw Error('Dedicated testnet relay wallet mismatch');
  if(journal.chainId!==lane.destinationChainId||!sameAddress(journal.contract,lane.destination))throw Error('Relay journal network mismatch');
 }
 async source(hash,destination){return this.inspect(hash,{rpc:this.sourceRpc,destinationRpc:this.rpc,destination});}
 async snapshot(){return this.read({rpc:this.rpc,native:this.native});}
 async register(hash){
  if(!validHash(hash))throw Error('Invalid source transaction hash');
  const old=this.journal.jobs.find(j=>sameAddress(j.sourceHash,hash));if(old)return old;
  if(this.journal.jobs.length>=32)throw Error('This operator journal has reached its request limit');
  const destination=await this.snapshot(),source=await this.source(hash,destination);
  if(['waiting','confirming'].includes(source.state))throw Error('Source confirmations are not ready');
  const concurrent=this.journal.jobs.find(j=>sameAddress(j.sourceHash,hash));if(concurrent)return concurrent;
  if(this.journal.jobs.length>=32)throw Error('This operator journal has reached its request limit');
  const job={sourceHash:hash,key:source.key,nonce:source.destinationNonce,amount:source.amount,recipient:source.recipient,state:source.message?'accepted':'waiting',createdAt:this.now()};
  this.journal.jobs.push(job);this.save(this.journal);return job;
 }
 async tick(){
  if(this.activeTick)return {state:'busy'};
  this.activeTick=true;try{return await this.advance();}finally{this.activeTick=false;}
 }
 validateSigned(job){
  const signed=Transaction.from(job.raw);
  if(signed.hash!==job.hash||signed.chainId!==BigInt(lane.destinationChainId)||!sameAddress(signed.from,this.expectedRelay)||!sameAddress(signed.to,lane.destination)||signed.value!==0n||signed.data!==vaultInterface.encodeFunctionData('submit',[lane.domain,BigInt(job.nonce),job.recipient,parseEther(job.amount)]))throw Error('Signed journal transaction does not match the configured instruction');
 }
 async advance(){
  const active=this.journal.jobs.find(j=>j.raw&&!['finalized','reverted','accepted'].includes(j.state));
  const job=active||this.journal.jobs.find(j=>j.state==='waiting');if(!job)return {state:'idle'};
  const destination=await this.snapshot(),source=await this.source(job.sourceHash,destination);
  if(['waiting','confirming'].includes(source.state))return {state:'waiting-for-source',sourceHash:job.sourceHash};
  if(source.key!==job.key||source.destinationNonce!==job.nonce||source.amount!==job.amount||!sameAddress(source.recipient,job.recipient))throw Error('Saved source instruction changed; relay stopped');
  if(job.raw){
   this.validateSigned(job);
   const receipt=await this.rpc('eth_getTransactionReceipt',[job.hash]);
   if(receipt){
    const block=await this.rpc('eth_getBlockByNumber',[receipt.blockNumber,false]);
    if(!block||block.hash!==receipt.blockHash||!sameAddress(receipt.to,lane.destination)||!sameAddress(receipt.from,this.expectedRelay)||!sameAddress(receipt.transactionHash,job.hash))throw Error('Destination receipt could not be verified');
    if(Number(BigInt(receipt.blockNumber))>destination.finalizedBlock)return {state:'included',hash:job.hash};
    job.state=BigInt(receipt.status)===1n?'finalized':'reverted';job.block=Number(BigInt(receipt.blockNumber));
    if(job.state==='finalized'&&!source.message)throw Error('Successful receipt has no matching finalized treasury message');
    job.completedAt=this.now();this.save(this.journal);return {state:job.state,hash:job.hash,key:job.key};
   }
   if(source.message){job.state='accepted';job.completedAt=this.now();this.save(this.journal);return {state:'accepted',key:job.key};}
   if(destination.paused)return {state:'paused',hash:job.hash};
   if(this.now()-(job.lastBroadcast||0)<20000)return {state:job.state,hash:job.hash};
   // Re-broadcasting these exact signed bytes does not create a replacement transaction.
   return this.broadcast(job);
  }
  if(source.message){job.state='accepted';job.completedAt=this.now();this.save(this.journal);return {state:'accepted',key:job.key};}
  if(destination.paused||destination.pendingPolicy)return {state:'paused',sourceHash:job.sourceHash};
  const used=this.journal.jobs.filter(j=>j.raw).reduce((total,j)=>total+parseEther(j.amount),0n);
  if(used+parseEther(job.amount)>parseEther('10'))throw Error('This dedicated demo journal has reached its 10 tPOT payout limit');
  if(BigInt(await this.rpc('eth_chainId'))!==BigInt(lane.destinationChainId))throw Error('Relay network mismatch');
  const [pending,latest]=await Promise.all([this.rpc('eth_getTransactionCount',[this.expectedRelay,'pending']),this.rpc('eth_getTransactionCount',[this.expectedRelay,'latest'])]);
  if(BigInt(pending)!==BigInt(latest))return {state:'other-transaction-pending'};
  const data=vaultInterface.encodeFunctionData('submit',[lane.domain,BigInt(job.nonce),job.recipient,parseEther(job.amount)]);
  const [gas,price,balance]=await Promise.all([this.rpc('eth_estimateGas',[{from:this.expectedRelay,to:lane.destination,data}]),this.rpc('eth_gasPrice'),this.rpc('eth_getBalance',[this.expectedRelay,'pending'])]);
  const gasLimit=BigInt(gas)*110n/100n,gasPrice=BigInt(price),cost=gasLimit*gasPrice;
  if(cost>parseEther('5')||cost+parseEther('0.1')>BigInt(balance))return {state:'relay-funding-needed'};
  const fresh=await this.snapshot(),checked=await this.source(job.sourceHash,fresh);
  if(checked.sourceBlockHash!==source.sourceBlockHash||checked.state!=='ready'||fresh.paused)return {state:'source-or-policy-changed'};
  if(BigInt(await this.rpc('eth_getTransactionCount',[this.expectedRelay,'pending']))!==BigInt(pending))return {state:'other-transaction-pending'};
  const raw=await this.wallet.signTransaction({chainId:lane.destinationChainId,type:0,to:lane.destination,value:0n,nonce:Number(BigInt(pending)),gasLimit,gasPrice,data});
  Object.assign(job,{raw,hash:keccak256(raw),state:'signed',signedAt:this.now(),lastBroadcast:0});
  this.validateSigned(job);
  this.save(this.journal);
  return this.broadcast(job);
 }
 async broadcast(job){
  job.lastBroadcast=this.now();this.save(this.journal);
  try{
   const hash=await this.rpc('eth_sendRawTransaction',[job.raw]);
   if(!sameAddress(hash,job.hash))throw Error('Unexpected broadcast hash');
   job.state='broadcast';
  }catch{job.state='uncertain';}
  this.save(this.journal);return {state:job.state,hash:job.hash};
 }
}
