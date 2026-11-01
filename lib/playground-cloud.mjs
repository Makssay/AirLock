import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {newPlayground,advancePlayground,actPlayground,formatDemo,demoPolicy} from './playground-model.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
export const emptyCloudState=()=>({sessions:{},requests:{},outbox:[],limits:{},updates:[]});
export class CloudPlayground{
 constructor(data=emptyCloudState(),now=Date.now()){this.data=data;this.now=now;this.clean();}
 clean(){const d=this.data;for(const [key,s]of Object.entries(d.sessions))if(s.expires<=this.now)delete d.sessions[key];d.outbox=d.outbox.filter(n=>d.sessions[n.session]);for(const [key,r]of Object.entries(d.requests))if(r.expires<=this.now)delete d.requests[key];for(const [key,r]of Object.entries(d.limits))if(r.expires<=this.now)delete d.limits[key];}
 limit(key,max,ms){const name=key+':'+Math.floor(this.now/ms),old=this.data.limits[name];if((old?.count||0)>=max)throw Error('Demo rate limit reached. Please wait');this.data.limits[name]={count:(old?.count||0)+1,expires:this.now+ms};}
 session(token){if(typeof token!=='string'||!/^[\w-]{43}$/.test(token))throw Error('Demo session expired. Create a new treasury');const s=Object.values(this.data.sessions).find(s=>s.auth===hash(token));if(!s)throw Error('Demo session expired. Create a new treasury');return s;}
 view(s){return {id:s.id,expiresAt:s.expires,now:this.now,state:advancePlayground(s.state,this.now),policy:demoPolicy,telegram:{connected:!!s.chat,notifications:this.data.outbox.filter(n=>n.session===s.id).toReversed().slice(0,12).map(({event,status,attempts,delivered})=>({event,status,attempts,delivered}))}};}
 enqueue(s,event,text,topic=null){if(s.chat&&!this.data.outbox.some(n=>n.session===s.id&&n.event===event))this.data.outbox.push({id:randomUUID(),session:s.id,event,text,topic,status:'pending',attempts:0,nextAt:this.now});}
 perform({token,client,requestId,input,botUsername}){
  if(typeof requestId!=='string'||!/^[-\w]{16,80}$/.test(requestId))throw Error('A unique request ID is required');
  if(!input||typeof input.action!=='string')throw Error('Choose a demo action');
  if(input.action==='status'){this.tick();return {session:this.view(this.session(token))};}
  const scope=input.action==='create'?'create:'+client:this.session(token).id,key=scope+':'+requestId,body=hash(JSON.stringify(input)),old=this.data.requests[key];
  if(old){if(old.body!==body)throw Error('Request ID was already used for a different action');const session=this.data.sessions[old.session];if(!session)throw Error('Demo session expired. Create a new treasury');return {session:this.view(session),...(old.token?{token:old.token}:{}),...(old.telegramUrl&&!session.chat&&session.pairUntil>this.now?{telegramUrl:old.telegramUrl}:{})};}
  let s,result;
  if(input.action==='create'){
   this.limit('create:'+client,20,3600000);this.limit('create:global',100,3600000);
   if(Object.keys(this.data.sessions).length>=30)throw Error('The demo is busy. Please try again after another session ends');
   const token=randomBytes(32).toString('base64url');s={id:randomUUID(),auth:hash(token),expires:this.now+3600000,state:newPlayground(this.now),chat:null,pair:null};this.data.sessions[s.id]=s;result={token,session:this.view(s)};
  }else{
   s=this.session(token);this.limit('action:'+s.id,60,60000);
   if(input.action==='telegram-link'){
    if(!botUsername)throw Error('Telegram is temporarily unavailable');if(s.chat)throw Error('Telegram is already connected');this.limit('pair:'+s.id,8,3600000);
    const pair=randomBytes(24).toString('base64url');s.pair=hash(pair);s.pairUntil=this.now+300000;result={session:this.view(s),telegramUrl:`https://t.me/${botUsername}?start=pg_${pair}`};
   }else if(input.action==='telegram-disconnect'){
    s.chat=null;s.pair=null;for(const n of this.data.outbox.filter(n=>n.session===s.id&&['pending','sending'].includes(n.status)))n.status='cancelled';result={session:this.view(s)};
   }else{
    if(s.state.events.length>=80)throw Error('This demo session is complete. Create another treasury');
    const {state,notifications}=actPlayground(s.state,input,this.now);s.state=state;
    for(const n of this.data.outbox.filter(n=>n.session===s.id&&n.status==='pending'&&((['cancel','execute'].includes(input.action)&&n.topic===input.messageId)||(input.action==='pause'&&n.topic))))n.status='cancelled';
    for(const n of notifications)this.enqueue(s,n.id,n.text,n.messageId||null);result={session:this.view(s)};
   }
  }
  this.data.requests[key]={body,session:s.id,token:result.token||null,telegramUrl:result.telegramUrl||null,expires:s.expires};
  return result;
 }
 connect(update){
  if(this.data.updates.includes(update.update_id))return false;
  const m=update.message,match=m?.text?.match(/^\/start(?:@\w+)? pg_([A-Za-z0-9_-]{32})$/);
  if(!match||m.chat?.type!=='private')return false;
  const s=Object.values(this.data.sessions).find(s=>s.pair===hash(match[1])&&s.pairUntil>this.now&&!s.chat);if(!s)return false;
  const chat=String(m.chat.id);
  for(const other of Object.values(this.data.sessions).filter(other=>other.chat===chat)){other.chat=null;for(const n of this.data.outbox.filter(n=>n.session===other.id&&['pending','sending'].includes(n.status)))n.status='cancelled';}
  s.chat=chat;s.pair=null;this.data.updates.push(update.update_id);this.data.updates=this.data.updates.slice(-200);
  this.enqueue(s,'connected','Your demo treasury is connected. All amounts here are educational tokens. Return to Try Airlock and run a payout scenario.');return true;
 }
 tick(){for(const s of Object.values(this.data.sessions))for(const m of s.state.messages.filter(m=>m.status==='queued'&&!s.state.paused)){
  const left=m.eligibleAt-this.now;if(left<=0)this.enqueue(s,m.id+':eligible',`${m.id}: ${formatDemo(m.amount)} demo tokens are eligible. Open the demo to review and execute.`,m.id);
  else if(left<=10000)this.enqueue(s,m.id+':reminder',`${m.id}: less than 10 seconds remain in the demo quarantine. Review this request now.`,m.id);
 }}
 claim(){
  for(const n of this.data.outbox.filter(n=>['pending','sending'].includes(n.status)&&n.nextAt<=this.now)){
   const s=this.data.sessions[n.session];if(!s?.chat)continue;
   const key='send:'+s.chat+':'+Math.floor(this.now/3600000);if((this.data.limits[key]?.count||0)>=30)continue;
   this.limit('send:global',30,60000);this.limit('send:'+s.chat,30,3600000);
   n.status='sending';n.attempts++;n.nextAt=this.now+30000;return {...n,chat:s.chat};
  }return null;
 }
 finish(id,ok,retryAfter=10){const n=this.data.outbox.find(n=>n.id===id);if(!n||n.status!=='sending')return;n.status=ok?'delivered':n.attempts>=5?'failed':'pending';if(ok)n.delivered=this.now;else n.nextAt=this.now+Math.min(86400,Math.max(5,retryAfter))*1000;}
}
