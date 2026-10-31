import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyPauseTiming} from '../lib/demo-timing.mjs';
import {LiveV3} from '../server/live-v3.mjs';

test('timely pause proof uses inclusion block time and rejects the exact expiry boundary',()=>{
 assert.equal(verifyPauseTiming({eligibleAt:120000,pauseBlockTimestamp:119}).marginSeconds,1);
 for(const timestamp of [120,121])assert.throws(()=>verifyPauseTiming({eligibleAt:120000,pauseBlockTimestamp:timestamp}));
 assert.throws(()=>verifyPauseTiming({eligibleAt:120000}));
});
test('history catch-up is bounded and retains a contiguous cursor for subsequent reads',async()=>{
 const live=Object.create(LiveV3.prototype);live.store={cursor:100,logs:[],messages:{}};live.save=()=>{};
 const ranges=[];live.rpc={getLogs:async range=>{ranges.push([range.fromBlock,range.toBlock]);return [];}};
 await live.syncLogs(5000);assert.equal(live.store.cursor,2100);assert.deepEqual(ranges,[[101,600],[601,1100],[1101,1600],[1601,2100]]);
 await live.syncLogs(2200);assert.equal(live.store.cursor,2200);assert.deepEqual(ranges.at(-1),[2101,2200]);
});

test('native job becomes finalized only after its block timestamp is recorded',async()=>{
 const live=Object.create(LiveV3.prototype);live.save=()=>{};
 const job={};const hash={toHex:()=> 'native-block-hash'};
 const api={query:{system:{account:async()=>({data:{free:10n**18n,frozen:0n}})}},rpc:{chain:{getHeader:async()=>({number:123})}},at:async()=>{
  assert.equal(job.status,'included');return {query:{timestamp:{now:async()=>120000}}};
 }};
 const tx={paymentInfo:async()=>({partialFee:1n}),signAsync:async()=>{},hash:{toHex:()=> 'tx-hash'},send:async callback=>{
  setImmediate(()=>callback({status:{isFinalized:true,asFinalized:hash},events:[]}));return ()=>{};
 }};
 await live.broadcastNative(job,api,{lock(){}},tx);
 assert.equal(job.status,'finalized');assert.equal(job.blockTimestamp,120000);assert.equal(job.blockNumber,123);
});
