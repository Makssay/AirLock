import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../server/session.mjs';

test('demo scenario records attack losses, quarantine, rejection and guardian response honestly',()=>{
 const session=new Session();session.action({action:'submit',amount:'20',recipient:'recipient',actor:'relay'});session.action({action:'attack'});
 let d=session.snapshot();assert.equal(d.state.balance,'905');assert.equal(d.state.spent,'95');assert.equal(d.state.reserved,'155');assert.equal(d.requests.filter(r=>r.status==='queued').length,4);assert.equal(d.requests.find(r=>r.amount==='900').status,'rejected');
 session.action({action:'pause'});session.action({action:'cancelAll'});d=session.snapshot();assert.equal(d.state.balance,'905');assert.equal(d.state.reserved,'0');assert.equal(d.state.paused,true);assert.equal(d.chainConnected,false);
});
test('replay attempt has its own rejected receipt without replacing the original accepted message',()=>{
 const s=new Session();s.action({action:'submit',amount:'20',recipient:'recipient',actor:'relay'});s.action({action:'replay'});const d=s.snapshot();assert.equal(d.requests[0].status,'rejected');assert.equal(d.requests[1].status,'released');assert.notEqual(d.requests[0].receiptId,d.requests[1].receiptId);assert.equal(d.state.balance,'980');
});
test('lab clock cannot move backward or take arbitrary unbounded steps',()=>{const s=new Session();for(const ms of [-1,1e15,'oops'])assert.throws(()=>s.action({action:'advance',ms}));s.action({action:'advance',ms:120000});assert.equal(s.snapshot().state.now,1800000120000);});
test('reset clears all receipts and restores the isolated reserve',()=>{const s=new Session();s.action({action:'attack'});s.action({action:'reset'});const d=s.snapshot();assert.equal(d.state.balance,'1000');assert.equal(d.requests.length,0);assert.equal(d.receipts.length,0);});
