import test from 'node:test';
import assert from 'node:assert/strict';
import { ContractFactory, id } from 'ethers';
import { startAnvil } from '../lib/anvil.mjs';
import { readFileSync } from 'node:fs';
const artifact=JSON.parse(readFileSync('artifacts/evm/Airlock.json','utf8'));
const fixture=JSON.parse(readFileSync('artifacts/evm/AdversarialRecipient.json','utf8'));
const U=1000000000000000000n;

test('Solidity Airlock: real EVM transactions enforce release and recovery invariants',async t=>{
 const rpc=await startAnvil();
 const provider=rpc.provider;
 const relay=await provider.getSigner(0),guardian=await provider.getSigner(1),recipient=await provider.getSigner(2),outsider=await provider.getSigner(3);
 const domain=id('airlock:external-testnet:v1');
 const initial=[25n*U,100n*U,120,400n*U];
 const deploy=async()=>{const c=await new ContractFactory(artifact.abi,artifact.bytecode,relay).deploy(await relay.getAddress(),await guardian.getAddress(),domain,initial,600,300,100n*U,{value:1000n*U});await c.waitForDeployment();return c;};
 const tx=async p=>(await p).wait();
 const advance=async seconds=>{await rpc.request({method:'evm_increaseTime',params:[seconds]});await rpc.request({method:'evm_mine',params:[]});};
 const vault=async c=>BigInt(await rpc.request({method:'eth_getBalance',params:[await c.getAddress(),'latest']}));
 try{
 await t.test('normal release creates a successful transaction and release event',async()=>{const c=await deploy();const r=await tx(c.submit(domain,1,await recipient.getAddress(),20n*U));assert.equal(r.status,1);assert.equal(await vault(c),980n*U);assert.equal(await c.spentThisWindow(),20n*U);assert.equal(c.interface.parseLog(r.logs[0]).name,'Released');});
 await t.test('unauthorized sender and wrong source domain are rejected',async()=>{const c=await deploy();await assert.rejects(c.connect(outsider).submit.staticCall(domain,1,await recipient.getAddress(),U));await assert.rejects(c.submit.staticCall(id('wrong'),1,await recipient.getAddress(),U));assert.equal(await vault(c),1000n*U);});
 await t.test('nonce replay with altered payment cannot execute',async()=>{const c=await deploy();await tx(c.submit(domain,1,await recipient.getAddress(),U));await assert.rejects(c.submit.staticCall(domain,1,await outsider.getAddress(),25n*U));});
 await t.test('split attack hits the window cap; queue execution cannot bypass it',async()=>{const c=await deploy();for(let n=1;n<=4;n++)await tx(c.submit(domain,n,await recipient.getAddress(),25n*U));await tx(c.submit(domain,5,await recipient.getAddress(),25n*U));const key=await c.messageId(domain,5);assert.equal((await c.messages(key)).status,1n);await advance(120);await assert.rejects(c.execute.staticCall(key));assert.equal(await vault(c),900n*U);});
 await t.test('timelock delays release and outsider may execute once mature',async()=>{const c=await deploy();await tx(c.submit(domain,1,await recipient.getAddress(),80n*U));const key=await c.messageId(domain,1);await assert.rejects(c.execute.staticCall(key));await advance(121);await tx(c.connect(outsider).execute(key));assert.equal(await c.reserved(),0n);assert.equal(await vault(c),920n*U);await assert.rejects(c.execute.staticCall(key));});
 await t.test('pause blocks releases; guardian can still cancel and replay stays forbidden',async()=>{const c=await deploy();await tx(c.submit(domain,1,await recipient.getAddress(),80n*U));const key=await c.messageId(domain,1);await tx(c.connect(guardian).pause());await assert.rejects(c.submit.staticCall(domain,2,await recipient.getAddress(),U));await advance(121);await assert.rejects(c.execute.staticCall(key));await assert.rejects(c.cancel.staticCall(key));await tx(c.connect(guardian).cancel(key));assert.equal(await c.reserved(),0n);assert.equal(await vault(c),1000n*U);assert.equal((await c.messages(key)).status,3n);});
 await t.test('queue capacity limits immobilized funds',async()=>{const c=await deploy();for(let n=0;n<5;n++)await tx(c.submit(domain,n,await recipient.getAddress(),80n*U));await assert.rejects(c.submit.staticCall(domain,5,await recipient.getAddress(),80n*U));assert.equal(await c.reserved(),400n*U);});
 await t.test('policy and resume activate only after the policy timelock',async()=>{const c=await deploy();await tx(c.connect(guardian).pause());await tx(c.connect(guardian).schedulePolicy([50n*U,200n*U,120,400n*U],true));assert.equal((await c.policy()).instant,25n*U);await assert.rejects(c.activatePolicy.staticCall());await advance(301);await tx(c.connect(outsider).activatePolicy());assert.equal((await c.policy()).instant,50n*U);assert.equal(await c.paused(),false);});
 await t.test('a rejecting recipient rolls back the release and its accounting',async()=>{const c=await deploy();const a=await new ContractFactory(fixture.abi,fixture.bytecode,relay).deploy();await a.waitForDeployment();await tx(a.configure(await c.getAddress(),id('missing'),true));const payout=c.submit(domain,1,await a.getAddress(),U,{gasLimit:500000});await assert.rejects(tx(payout));assert.equal(await c.spentThisWindow(),0n);assert.equal((await c.messages(await c.messageId(domain,1))).status,0n);assert.equal(await vault(c),1000n*U);});
 await t.test('native payout recipient cannot reenter a mature queued release',async()=>{const c=await deploy();await tx(c.submit(domain,1,await recipient.getAddress(),80n*U));const key=await c.messageId(domain,1);await advance(121);const a=await new ContractFactory(fixture.abi,fixture.bytecode,relay).deploy();await a.waitForDeployment();await tx(a.configure(await c.getAddress(),key,false));await tx(c.submit(domain,2,await a.getAddress(),U));assert.equal(await a.reentryBlocked(),true);assert.equal((await c.messages(key)).status,1n);assert.equal(await c.reserved(),80n*U);assert.equal(await vault(c),999n*U);});
 }finally{await rpc.close();}
});
