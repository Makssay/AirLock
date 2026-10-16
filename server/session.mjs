import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { WasmLab } from '../lib/wasm-lab.mjs';
import { ACTORS, DOMAIN, UNIT, hex, human, units, submission, messageCall, messageKey, policyCall } from '../lib/abi.mjs';

export class Session {
 constructor(){this.reset();}
 reset(){this.lab=new WasmLab();this.requests=[];this.receipts=[];this.nonce=1;this.createdAt=new Date().toISOString();this.wasmHash=createHash('sha256').update(readFileSync(new URL('../artifacts/airlock.wasm',import.meta.url))).digest('hex');}
 record(action,fn,extra={}) {
  const before=this.lab.state();let result,error;
  try{result=fn();}catch(e){error=e;}
  const after=this.lab.state();
  const receipt={sequence:this.receipts.length+1,action,ok:!error,error:error?.message||null,errorCode:error?.code??null,labTime:this.lab.now,balanceBefore:human(before.balance),balanceAfter:human(after.balance),spentAfter:human(after.spent),reservedAfter:human(after.reserved),...extra};
  receipt.id=createHash('sha256').update(JSON.stringify(receipt)).digest('hex');this.receipts.push(receipt);
  return {result,error,receipt};
 }
 submit(amount,recipient='recipient',actor='relay',nonce=null) {
  if(!['recipient','attacker'].includes(recipient)||!['relay','outsider'].includes(actor))throw Error('Invalid lab role');
  const n=nonce===null?this.nonce++:Number(nonce);if(!Number.isSafeInteger(n)||n<0)throw Error('Invalid nonce');
  const value=units(amount);const key=messageKey(n);const input=submission(n,ACTORS[recipient],value);
  const {error,receipt}=this.record('submit',()=>this.lab.call(input,ACTORS[actor]),{nonce:n,recipient,amount:human(value),messageId:hex(key),actor});
  this.requests.push({key:hex(key),nonce:n,recipient,amount:human(value),submittedAt:this.lab.now,error:error?.message||null,receiptId:receipt.id,accepted:!error});
  return receipt;
 }
 snapshot(){
  const s=this.lab.state();const amounts=['instant','cap','reserveFloor','maxPending','reserved','spent','balance'];const state={...s};for(const k of amounts)state[k]=human(s[k]);
  if(state.plan)for(const k of ['instant','cap','maxPending'])state.plan[k]=human(s.plan[k]);
  const requests=this.requests.map(r=>{if(!r.accepted)return {...r,status:'rejected'};const m=this.lab.message(Buffer.from(r.key.slice(2),'hex'));return {...r,...m,amount:human(m.amount),recipient:r.recipient};});
  const paid=[...this.lab.balances.entries()].map(([account,v])=>({account,amount:human(v)}));
  return {mode:'wasm-lab',execution:'Compiled Rust contract / isolated seal0 host',chainConnected:false,wasmHash:this.wasmHash,createdAt:this.createdAt,state,requests:requests.toReversed(),receipts:this.receipts.toReversed(),paid,actors:Object.fromEntries(Object.entries(ACTORS).map(([k,v])=>[k,hex(v)])),domain:hex(DOMAIN)};
 }
 action(body) {
  const {action}=body;
  if(action==='reset'){this.reset();return;}
  if(action==='submit')return this.submit(body.amount,body.recipient,body.actor);
  if(action==='attack') {const results=[];for(let i=0;i<6;i++)results.push(this.submit('25','attacker'));results.push(this.submit('80','attacker'));results.push(this.submit('900','attacker'));return results;}
  if(action==='replay') {const r=this.requests.find(x=>x.accepted);if(!r)throw Error('Submit a message before testing replay');return this.submit(r.amount,'attacker','relay',r.nonce);}
  if(action==='advance'){const ms=Number(body.ms);if(![120000,300000,600000].includes(ms))throw Error('Invalid clock step');this.lab.advance(ms);return;}
  if(['execute','cancel'].includes(action)) {if(!/^0x[0-9a-f]{64}$/.test(body.key||''))throw Error('Invalid message ID');const key=Buffer.from(body.key.slice(2),'hex');return this.record(action,()=>this.lab.call(messageCall(action==='execute'?2:3,key),action==='cancel'?ACTORS.guardian:ACTORS.outsider),{messageId:body.key}).receipt;}
  if(action==='pause')return this.record('pause',()=>this.lab.call([4],ACTORS.guardian),{actor:'guardian'}).receipt;
  if(action==='cancelAll') {const queued=this.snapshot().requests.filter(r=>r.status==='queued'&&r.accepted);return [...new Set(queued.map(r=>r.key))].map(key=>this.action({action:'cancel',key}));}
  if(action==='policy')return this.record('schedulePolicy',()=>this.lab.call(policyCall({instant:units(body.instant),cap:units(body.cap),delay:BigInt(body.delaySeconds)*1000n,maxPending:units(body.maxPending),resume:!!body.resume}),ACTORS.guardian),{actor:'guardian'}).receipt;
  if(action==='activatePolicy')return this.record('activatePolicy',()=>this.lab.call([6])).receipt;
  if(action==='cancelPolicy')return this.record('cancelPolicy',()=>this.lab.call([8],ACTORS.guardian),{actor:'guardian'}).receipt;
  throw Error('Unknown action');
 }
}
