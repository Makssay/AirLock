import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLiveAction,LiveV3} from '../server/live-v3.mjs';

test('live console rejects sandbox clock/reset and arbitrary transaction methods',()=>{
 for(const action of ['advance','reset','transfer','deploy','eth_sendTransaction','constructor'])assert.throws(()=>validateLiveAction({action}));
});
test('testnet request bounds use exact amounts and never accept a caller-selected recipient or nonce',()=>{
 for(const amount of ['-1','0','5.0001','1e-3','Infinity','0x10','0.00001',1])assert.throws(()=>validateLiveAction({action:'submit',amount}));
 assert.deepEqual(validateLiveAction({action:'submit',amount:'0.25',recipient:'0xevil',nonce:'1',rpc:'https://evil'}),{action:'submit',amount:'0.25'});
});
test('policy controls preserve cap, queue and delay limits and require an explicit resume boolean',()=>{
 const base={action:'policy',instant:'1',cap:'5',maxPending:'20',delaySeconds:120,resume:true};
 assert.equal(validateLiveAction(base).delaySeconds,120);
 for(const change of [{instant:'6'},{cap:'6'},{delaySeconds:0},{delaySeconds:119},{maxPending:'21'},{resume:'true'}])assert.throws(()=>validateLiveAction({...base,...change}));
});
test('request IDs deduplicate execution and pending/uncertain transactions block a second write',async()=>{
 const live=Object.create(LiveV3.prototype);let calls=0;
 live.store={jobs:[]};live.save=()=>{};live.busy=false;live.run=async job=>{calls++;job.status='checked';};
 const key='test-idempotency-key-0001';const first=live.start({action:'pause'},key);
 assert.equal(live.start({action:'pause'},key),first);
 assert.throws(()=>live.start({action:'pause'},'test-idempotency-key-0002'));
 await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls,1);live.store.jobs.push({requestId:'another-id',status:'uncertain',input:{action:'submit'}});
 assert.throws(()=>live.start({action:'submit',amount:'1'},'test-idempotency-key-0003'));
});
test('independent guardian can pause while a source/relay transaction is waiting, without allowing two guardian writes',async()=>{
 const live=Object.create(LiveV3.prototype);live.store={jobs:[{id:'relay',status:'submitted',input:{action:'submit'}}]};live.save=()=>{};live.busy=true;live.running=new Set(['relay']);live.run=async job=>{job.status='finalized';};
 const pause=live.start({action:'pause'},'emergency-pause-key-0001');
 assert.equal(pause.input.action,'pause');assert.throws(()=>live.start({action:'pause'},'emergency-pause-key-0002'));
 await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));assert.equal(live.busy,true);
});
