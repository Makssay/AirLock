import test from 'node:test';
import assert from 'node:assert/strict';
import { WasmLab, ContractError } from '../lib/wasm-lab.mjs';
import { ACTORS as A, UNIT as U, DOMAIN, address, configuration, submission, messageCall, policyCall, hex } from '../lib/abi.mjs';
const send=(lab,n,amount,to=A.recipient,actor=A.relay)=>lab.call(submission(n,to,BigInt(amount)*U),actor);
const fails=(fn,code)=>assert.throws(fn,e=>e instanceof ContractError && e.code===code);
const policy=(lab,overrides={})=>lab.call(policyCall({instant:25n*U,cap:100n*U,delay:120000,maxPending:400n*U,...overrides}),A.guardian);

test('compiled WASM releases an authorized small payment and records its event',()=>{
 const l=new WasmLab();const key=send(l,1,20);assert.equal(l.message(key).status,'released');assert.equal(l.balance,980n*U);assert.equal(l.state().spent,20n*U);assert.equal(l.balances.get(hex(A.recipient)),20n*U);assert.equal(l.events.at(-1)[0],2);
});
test('unauthorized relay cannot submit; no state or funds change',()=>{
 const l=new WasmLab();fails(()=>send(l,1,20,A.attacker,A.outsider),9);assert.equal(l.balance,1000n*U);assert.equal(l.events.length,0);
});
test('source domain is enforced',()=>{const l=new WasmLab();fails(()=>l.call(submission(1,A.attacker,20n*U,address(99)),A.relay),11);});
test('replay is rejected, including a changed recipient or amount',()=>{const l=new WasmLab();send(l,1,20);fails(()=>send(l,1,25,A.attacker),12);assert.equal(l.balance,980n*U);});
test('large payment is quarantined, reserving funds without transferring',()=>{const l=new WasmLab();const k=send(l,1,80);assert.equal(l.message(k).status,'queued');assert.equal(l.state().reserved,80n*U);assert.equal(l.balance,1000n*U);});
test('queue cannot execute early; any caller can execute after the delay',()=>{const l=new WasmLab();const k=send(l,1,80);fails(()=>l.call(messageCall(2,k)),16);l.advance(120000);l.call(messageCall(2,k));assert.equal(l.message(k).status,'released');assert.equal(l.state().reserved,0n);});
test('splitting an attack into small messages cannot bypass the cumulative window cap',()=>{const l=new WasmLab();for(let i=0;i<4;i++)send(l,i,25,A.attacker);const k=send(l,4,25,A.attacker);assert.equal(l.balance,900n*U);assert.equal(l.message(k).status,'queued');l.advance(120000);fails(()=>l.call(messageCall(2,k)),6);assert.equal(l.state().reserved,25n*U);});
test('queued execution obeys the cap and can be retried in a later fixed window',()=>{const l=new WasmLab();const a=send(l,1,80),b=send(l,2,80);l.advance(120000);l.call(messageCall(2,a));fails(()=>l.call(messageCall(2,b)),6);l.advance(600000);l.call(messageCall(2,b));assert.equal(l.balance,840n*U);});
test('cancel is guardian-only; cancelled IDs remain spent',()=>{const l=new WasmLab();const k=send(l,1,80);fails(()=>l.call(messageCall(3,k),A.relay),3);l.call(messageCall(3,k),A.guardian);assert.equal(l.state().reserved,0n);fails(()=>send(l,1,80),12);l.advance(120000);fails(()=>l.call(messageCall(2,k)),15);});
test('pause blocks both immediate and queued release, while cancellation remains possible',()=>{const l=new WasmLab();const k=send(l,1,80);l.call([4],A.guardian);fails(()=>send(l,2,20),10);l.advance(120000);fails(()=>l.call(messageCall(2,k)),10);l.call(messageCall(3,k),A.guardian);assert.equal(l.balance,1000n*U);});
test('relay cannot pause, cancel, schedule policy or invalidate a policy plan',()=>{const l=new WasmLab();for(const op of [4,8])fails(()=>l.call([op],A.relay),3);fails(()=>l.call(policyCall({instant:U,cap:U,delay:1,maxPending:U}),A.relay),3);});
test('quarantine capacity bounds relay reservations',()=>{const l=new WasmLab();for(let i=0;i<5;i++)send(l,i,80);fails(()=>send(l,6,80),13);assert.equal(l.state().reserved,400n*U);});
test('reserve floor and all queued reservations are respected by instant releases',()=>{const l=new WasmLab({balance:200n*U});send(l,1,80);send(l,2,20);fails(()=>send(l,3,1),8);assert.equal(l.balance,180n*U);});
test('zero, oversized and zero-address payouts are rejected',()=>{const l=new WasmLab();fails(()=>send(l,1,0),5);fails(()=>send(l,2,101),18);fails(()=>send(l,3,1,address(0)),5);});
test('failed transfer atomically rolls back message, budget and event',()=>{const l=new WasmLab();l.failTransfers=true;fails(()=>send(l,1,20),7);assert.equal(l.state().spent,0n);assert.equal(l.events.length,0);l.failTransfers=false;send(l,1,20);assert.equal(l.balance,980n*U);});
test('failed queued transfer restores pending reservation and status',()=>{const l=new WasmLab();const k=send(l,1,80);l.advance(120000);l.failTransfers=true;fails(()=>l.call(messageCall(2,k)),7);assert.equal(l.message(k).status,'queued');assert.equal(l.state().reserved,80n*U);assert.equal(l.state().spent,0n);});
test('policy change and resume are delayed; scheduling does not alter live policy',()=>{const l=new WasmLab();l.call([4],A.guardian);policy(l,{instant:50n*U,cap:200n*U,resume:true});assert.equal(l.state().instant,25n*U);assert.equal(l.state().paused,true);fails(()=>l.call([6]),16);l.advance(300000);l.call([6]);assert.equal(l.state().instant,50n*U);assert.equal(l.state().paused,false);assert.equal(l.state().plan,null);});
test('guardian can cancel a pending policy',()=>{const l=new WasmLab();policy(l);l.call([8],A.guardian);l.advance(300000);fails(()=>l.call([6]),17);});
test('replacement policy starts a fresh delay',()=>{const l=new WasmLab();policy(l);l.advance(299000);policy(l,{cap:200n*U});l.advance(1000);fails(()=>l.call([6]),16);});
test('policy changes do not shorten the delay of existing messages',()=>{const l=new WasmLab({config:configuration({policyDelay:1000n})});const k=send(l,1,80);policy(l,{delay:1});l.advance(1000);l.call([6]);fails(()=>l.call(messageCall(2,k)),16);});
test('invalid policies and identical relay/guardian are rejected',()=>{assert.throws(()=>new WasmLab({config:configuration({guardian:A.relay})}),e=>e.code===5);const l=new WasmLab();fails(()=>policy(l,{cap:1n}),5);});
test('malformed ABI is rejected without poisoning subsequent execution',()=>{const l=new WasmLab();for(const b of [[],[1],[4,1],[99]])fails(()=>l.call(b,A.guardian),1);send(l,1,20);assert.equal(l.balance,980n*U);});
test('deterministic mixed attack preserves reserve and conservation invariants',()=>{
 const l=new WasmLab();let rng=173;const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng;};const keys=[];
 for(let i=0;i<250;i++){
  try{const choice=random()%5;if(choice<=1)keys.push(send(l,i,1+random()%100,A.attacker));else if(choice===2&&keys.length)l.call(messageCall(2,keys[random()%keys.length]));else if(choice===3&&keys.length)l.call(messageCall(3,keys[random()%keys.length]),A.guardian);else l.advance(random()%100000);}catch(e){if(!(e instanceof ContractError))throw e;}
  const s=l.state();assert.ok(s.reserved>=0n);assert.ok(s.balance>=s.reserved+s.reserveFloor);assert.ok(s.spent<=s.cap);
  const paid=[...l.balances.values()].reduce((a,b)=>a+b,0n);assert.equal(s.balance+paid,1000n*U);
  const pending=keys.reduce((sum,k)=>{const m=l.message(k);return sum+(m.status==='queued'?m.amount:0n);},0n);assert.equal(s.reserved,pending);
 }
});
