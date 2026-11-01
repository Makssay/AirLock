import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {newPlayground,actPlayground} from '../lib/playground-model.mjs';
import {CloudPlayground} from '../lib/playground-cloud.mjs';
const now=1800000000000;
const act=(state,input,time=now)=>actPlayground(state,input,time).state;

test('demo legitimate payout rejects early execution and settles exactly after quarantine',()=>{
 let state=act(newPlayground(now),{action:'fund'});
 state=act(state,{action:'request',scenario:'legitimate'});
 assert.equal(state.balance,5000);assert.equal(state.reserved,200);
 assert.throws(()=>act(state,{action:'execute',messageId:'request-1'},now+19999),/TooEarly/);
 state=act(state,{action:'execute',messageId:'request-1'},now+20000);
 assert.equal(state.balance,4800);assert.equal(state.paid,200);assert.equal(state.reserved,0);
 assert.throws(()=>act(state,{action:'execute',messageId:'request-1'},now+21000));
});
test('demo guardian cancels while paused and resumes only after policy delay',()=>{
 let state=act(newPlayground(now),{action:'fund'});
 state=act(state,{action:'request',scenario:'suspicious'});state=act(state,{action:'pause'});
 assert.throws(()=>act(state,{action:'execute',messageId:'request-1'},now+21000),/pause/);
 state=act(state,{action:'cancel',messageId:'request-1'});assert.equal(state.balance,5000);assert.equal(state.reserved,0);
 state=act(state,{action:'schedule-resume'});
 assert.throws(()=>act(state,{action:'activate-resume'},now+9999));
 assert.equal(act(state,{action:'activate-resume'},now+10000).paused,false);
});
test('demo cumulative cap, oversized rejection and reserve floor cannot be bypassed',()=>{
 let state=act(newPlayground(now),{action:'fund'});
 for(let i=0;i<10;i++)state=act(state,{action:'request',scenario:'normal'});
 assert.equal(state.paid,500);
 state=act(state,{action:'request',scenario:'normal'});assert.equal(state.messages.at(-1).status,'queued');
 assert.throws(()=>act(state,{action:'execute',messageId:'request-11'},now+21000),/budget/);
 const rejected=actPlayground(state,{action:'request',scenario:'oversized'},now);
 assert.equal(rejected.state.reserved,state.reserved);assert.equal(rejected.state.events.at(-1).type,'rejected');
 let empty=newPlayground(now);assert.throws(()=>act(empty,{action:'request',scenario:'legitimate'}),/funds/);
});
function fixture(){let clock=now,data;const get=()=>{const store=new CloudPlayground(data,clock);data=store.data;return store;};const call=(token,input,requestId=randomUUID())=>get().perform({token,input,requestId,client:'a'.repeat(64),botUsername:'AirlockDemoBot'});return {get,call,setTime:value=>{clock=value;}};}
function pair(f,token,chat=123456){const response=f.call(token,{action:'telegram-link'});const payload=new URL(response.telegramUrl).searchParams.get('start');assert.equal(f.get().connect({update_id:Math.floor(Math.random()*1e9),message:{text:'/start '+payload,chat:{id:chat,type:'private'}}}),true);return payload;}
test('cloud sessions isolate balances and idempotent requests cannot replay mutations',()=>{
 const f=fixture(),a=f.call(null,{action:'create'}),b=f.call(null,{action:'create'}),key=randomUUID();
 f.call(a.token,{action:'fund'},key);f.call(a.token,{action:'fund'},key);
 assert.equal(f.call(a.token,{action:'status'}).session.state.balance,5000);assert.equal(f.call(b.token,{action:'status'}).session.state.balance,0);
 assert.throws(()=>f.call(a.token,{action:'pause'},key),/different/);assert.throws(()=>f.call('bad-token',{action:'status'}),/expired/);
});
test('cloud pairing is private, one-time, expiring and bound to a private chat',()=>{
 const f=fixture(),a=f.call(null,{action:'create'}),payload=pair(f,a.token);
 assert.equal(f.get().connect({update_id:8,message:{text:'/start '+payload,chat:{id:456,type:'private'}}}),false);
 assert.ok(!JSON.stringify(f.call(a.token,{action:'status'})).includes('123456'));
 const b=f.call(null,{action:'create'}),link=f.call(b.token,{action:'telegram-link'}).telegramUrl;
 const update={update_id:9,message:{text:'/start '+new URL(link).searchParams.get('start'),chat:{id:4,type:'group'}}};assert.equal(f.get().connect(update),false);
 update.message.chat.type='private';f.setTime(now+300001);assert.equal(f.get().connect(update),false);
});
test('cloud outbox supersedes reminders and leases deliveries across persisted state',()=>{
 const f=fixture(),a=f.call(null,{action:'create'});pair(f,a.token);f.call(a.token,{action:'fund'});f.call(a.token,{action:'request',scenario:'legitimate'});
 f.setTime(now+11000);f.get().tick();f.get().tick();assert.equal(f.get().data.outbox.filter(n=>n.event.endsWith(':reminder')).length,1);
 f.call(a.token,{action:'cancel',messageId:'request-1'});assert.equal(f.get().data.outbox.filter(n=>n.topic==='request-1'&&n.status==='pending').length,1);
 const claimed=f.get().claim();assert.ok(claimed);const snapshot=JSON.parse(JSON.stringify(f.get().data)),restart=new CloudPlayground(snapshot,now+11000);
 assert.ok(!restart.claim()||restart.data.outbox.find(n=>n.id===claimed.id).status==='sending');restart.finish(claimed.id,false,120);
 assert.equal(restart.data.outbox.find(n=>n.id===claimed.id).nextAt,now+131000);
});
test('cloud re-pairing disconnects the old treasury and sessions expire',()=>{
 const f=fixture(),a=f.call(null,{action:'create'}),b=f.call(null,{action:'create'});pair(f,a.token);pair(f,b.token);
 assert.equal(f.call(a.token,{action:'status'}).session.telegram.connected,false);assert.equal(f.call(b.token,{action:'status'}).session.telegram.connected,true);
 f.setTime(now+3600001);assert.throws(()=>f.call(b.token,{action:'status'}),/expired/);assert.equal(Object.keys(f.get().data.sessions).length,0);
});
test('cloud anonymous creation has a per-client cap',()=>{const f=fixture();for(let i=0;i<20;i++)f.call(null,{action:'create'});assert.throws(()=>f.call(null,{action:'create'}),/rate limit/);});
test('cloud CAS retries concurrent writes and idempotency prevents concurrent duplicate funding',async()=>{
 const {change}=await import('../services/playground/runtime.mjs');
 let row=null;
 const DB={prepare(sql){let args=[];const stmt={bind(...values){args=values;return stmt;},async first(){await new Promise(resolve=>setImmediate(resolve));return structuredClone(row);},async run(){await new Promise(resolve=>setImmediate(resolve));if(sql.startsWith('INSERT')){if(!row)row={revision:0,value:args[0]};return {meta:{changes:1}};}if(row.revision!==args[1])return {meta:{changes:0}};row={revision:row.revision+1,value:args[0]};return {meta:{changes:1}};}};return stmt;}};
 const create=await change({DB},store=>store.perform({input:{action:'create'},client:'client',requestId:randomUUID()}));
 const requestId=randomUUID();const fund=()=>change({DB},store=>store.perform({token:create.token,client:'client',requestId,input:{action:'fund'}}));await Promise.all([fund(),fund()]);
 const status=await change({DB},store=>store.perform({token:create.token,requestId:randomUUID(),input:{action:'status'}}));assert.equal(status.session.state.balance,5000);
});
