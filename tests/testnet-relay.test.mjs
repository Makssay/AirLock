import test from 'node:test';
import assert from 'node:assert/strict';
import {Wallet,parseEther,Transaction} from 'ethers';
import {TestnetRelay} from '../server/testnet-relay.mjs';
import {lane,vaultInterface} from '../lib/testnet-lane.mjs';
// Public deterministic test key, never funded or used on a public network.
const wallet=new Wallet('0x'+'01'.repeat(32));
const sourceHash='0x'+'ab'.repeat(32),blockHash='0x'+'cd'.repeat(32),key='0x'+'ef'.repeat(32);
function fixture(){
 const journal={chainId:lane.destinationChainId,contract:lane.destination,jobs:[]},writes=[],broadcasts=[];
 let time=100000,signatures=0,receipt=null,pending='0x0',source={state:'ready',key,destinationNonce:'42',amount:'2.0',recipient:lane.guardian,sourceBlockHash:blockHash},snapshot={paused:false,pendingPolicy:null,finalizedBlock:10};
 const rpc=async(method,params)=>{
  if(method==='eth_chainId')return '0x190f1ca9';if(method==='eth_getTransactionCount')return params[1]==='pending'?pending:'0x0';
  if(method==='eth_estimateGas')return '0x10000';if(method==='eth_gasPrice')return '0x3b9aca00';if(method==='eth_getBalance')return '0x'+parseEther('10').toString(16);
  if(method==='eth_getTransactionReceipt')return receipt;if(method==='eth_getBlockByNumber')return {hash:blockHash};
  if(method==='eth_sendRawTransaction'){assert.equal(writes.at(-1).jobs[0].raw,params[0]);broadcasts.push(params[0]);return Transaction.from(params[0]).hash;}
  throw Error('Unexpected RPC '+method);
 };
 const options={journal,save:value=>writes.push(structuredClone(value)),wallet:{address:wallet.address,signTransaction:async tx=>{signatures++;return wallet.signTransaction(tx);}},expectedRelay:wallet.address,rpc,read:async()=>snapshot,inspect:async()=>source,now:()=>time};
 const relay=new TestnetRelay(options);
 return {relay,journal,writes,broadcasts,options,get signatures(){return signatures;},set time(value){time=value;},set source(value){source=value;},get source(){return source;},set snapshot(value){snapshot=value;},get snapshot(){return snapshot;},set receipt(value){receipt=value;},set pending(value){pending=value;}};
}
test('relay persists the exact signed transaction before broadcasting and duplicate registration is idempotent',async()=>{
 const f=fixture();await Promise.all([f.relay.register(sourceHash),f.relay.register(sourceHash)]);assert.equal(f.journal.jobs.length,1);
 const result=await f.relay.tick();assert.equal(result.state,'broadcast');assert.equal(f.signatures,1);assert.equal(f.broadcasts.length,1);
 assert.equal(f.writes.some(s=>s.jobs[0]?.state==='signed'),true);
});
test('lost broadcast response and process restart reuse the original bytes without a second signature',async()=>{
 const f=fixture();await f.relay.register(sourceHash);
 const rpc=f.options.rpc;f.relay.rpc=async(method,params)=>{if(method==='eth_sendRawTransaction')throw Error('response lost');return rpc(method,params);};
 assert.equal((await f.relay.tick()).state,'uncertain');const raw=f.journal.jobs[0].raw;
 f.time=130000;const restarted=new TestnetRelay({...f.options,rpc});assert.equal((await restarted.tick()).state,'broadcast');
 assert.equal(f.broadcasts[0],raw);assert.equal(f.signatures,1);
});
test('tip inclusion is not called finalized; a matching finalized receipt ends the operation',async()=>{
 const f=fixture();await f.relay.register(sourceHash);await f.relay.tick();const job=f.journal.jobs[0];
 f.receipt={transactionHash:job.hash,to:lane.destination,from:wallet.address,blockHash,blockNumber:'0xb',status:'0x1'};
 assert.equal((await f.relay.tick()).state,'included');assert.equal(job.state,'broadcast');
 f.snapshot={...f.snapshot,finalizedBlock:11};f.source={...f.source,state:'accepted',message:{status:'queued'}};
 assert.equal((await f.relay.tick()).state,'finalized');assert.equal(job.state,'finalized');assert.equal(f.signatures,1);
});
test('finalized revert is retained and is never automatically signed again',async()=>{
 const f=fixture();await f.relay.register(sourceHash);await f.relay.tick();const job=f.journal.jobs[0];
 f.receipt={transactionHash:job.hash,to:lane.destination,from:wallet.address,blockHash,blockNumber:'0xa',status:'0x0'};
 assert.equal((await f.relay.tick()).state,'reverted');assert.equal((await f.relay.tick()).state,'idle');assert.equal(f.signatures,1);
});
test('paused treasury and an unrelated pending wallet transaction block a new signature',async()=>{
 const f=fixture();await f.relay.register(sourceHash);f.snapshot={...f.snapshot,paused:true};assert.equal((await f.relay.tick()).state,'paused');assert.equal(f.signatures,0);
 f.snapshot={...f.snapshot,paused:false};f.pending='0x1';assert.equal((await f.relay.tick()).state,'other-transaction-pending');assert.equal(f.signatures,0);
});
test('concurrent ticks cannot generate two signatures',async()=>{
 const f=fixture();await f.relay.register(sourceHash);const results=await Promise.all([f.relay.tick(),f.relay.tick()]);assert.equal(results.some(r=>r.state==='busy'),true);assert.equal(f.signatures,1);
});
test('changed source instruction or tampered signed bytes stop recovery before rebroadcast',async()=>{
 const f=fixture();await f.relay.register(sourceHash);await f.relay.tick();f.time=130000;
 f.source={...f.source,amount:'4.0'};await assert.rejects(f.relay.tick(),/changed/);assert.equal(f.broadcasts.length,1);
 f.source={...f.source,amount:'2.0'};f.journal.jobs[0].amount='3.0';await assert.rejects(f.relay.tick(),/changed/);
 f.journal.jobs[0].amount='2.0';f.journal.jobs[0].raw=await wallet.signTransaction({chainId:420420777,to:lane.destination,value:1n,nonce:0,gasLimit:100000,gasPrice:1n,data:vaultInterface.encodeFunctionData('submit',[lane.domain,42,lane.guardian,parseEther('2')])});
 await assert.rejects(f.relay.tick(),/Signed journal/);assert.equal(f.broadcasts.length,1);
});
test('a finalized existing message reconciles an interrupted request without new payout or signature',async()=>{
 const f=fixture();await f.relay.register(sourceHash);f.source={...f.source,state:'accepted',message:{status:'released'}};
 assert.equal((await f.relay.tick()).state,'accepted');assert.equal(f.signatures,0);assert.equal(f.broadcasts.length,0);
});
test('insufficient relay funding stops before signing',async()=>{
 const f=fixture();await f.relay.register(sourceHash);const rpc=f.options.rpc;
 f.relay.rpc=async(method,params)=>method==='eth_getBalance'?'0x1':rpc(method,params);
 assert.equal((await f.relay.tick()).state,'relay-funding-needed');assert.equal(f.signatures,0);
});
