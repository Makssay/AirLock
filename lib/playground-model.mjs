// Educational units: 100 = 1 demo token. No wallets or blockchain calls.
export const demoPolicy = Object.freeze({instant:100,cap:500,reserveFloor:500,maxPending:2000,delayMs:20000,windowMs:60000,resumeDelayMs:10000});
export const amounts = Object.freeze({normal:50,legitimate:200,suspicious:400,oversized:4000});
export const formatDemo = units => (units/100).toFixed(2);

export function newPlayground(now){return {version:0,balance:0,funded:0,paid:0,reserved:0,paused:false,resumeAt:null,spent:0,windowId:Math.floor(now/demoPolicy.windowMs),nextNonce:1,messages:[],events:[]};}
export function advancePlayground(state,now){const next=structuredClone(state);const windowId=Math.floor(now/demoPolicy.windowMs);if(next.windowId!==windowId){next.windowId=windowId;next.spent=0;}return next;}
export function actPlayground(state,input,now){
 const next=advancePlayground(state,now),notifications=[];
 if(!input||typeof input.action!=='string')throw Error('Choose a demo action');
 const event=(type,text,messageId)=>{next.events.push({id:next.version+1,type,text,messageId,at:now});next.version++;};
 const notify=(type,text,messageId)=>notifications.push({id:`${next.version}:${type}`,type,text,messageId});
 if(input.action==='fund'){
  if(next.funded>=10000)throw Error('This demo treasury already received its 100-token allowance');
  next.balance+=5000;next.funded+=5000;event('funded','Added 50.00 demo tokens to your treasury.');
 }else if(input.action==='request'){
  if(!Object.hasOwn(amounts,input.scenario))throw Error('Choose a listed payout scenario');
  if(next.messages.length>=12)throw Error('This session has reached its request limit');
  if(next.paused)throw Error('Releases are paused. Schedule and activate a resume first');
  const amount=amounts[input.scenario],nonce=next.nextNonce++;
  if(amount>demoPolicy.cap){event('rejected','Request rejected: amount exceeds the entire window cap.');notify('rejected','An oversized 40.00-token request was rejected by the demo policy.');return {state:next,notifications};}
  if(next.reserved+amount+demoPolicy.reserveFloor>next.balance)throw Error('Add demo funds before submitting this payout');
  const instant=amount<=demoPolicy.instant&&next.spent+amount<=demoPolicy.cap;
  const message={id:`request-${nonce}`,nonce,scenario:input.scenario,amount,recipient:input.scenario==='suspicious'?'Unrecognized recipient':'Team payout recipient',status:instant?'released':'queued',createdAt:now,eligibleAt:instant?null:now+demoPolicy.delayMs};
  if(!instant&&next.reserved+amount>demoPolicy.maxPending)throw Error('Demo queue capacity reached');
  next.messages.push(message);
  if(instant){next.balance-=amount;next.spent+=amount;next.paid+=amount;event('released',`Request ${nonce}: ${formatDemo(amount)} demo tokens paid.`,message.id);notify('released',`${formatDemo(amount)} demo tokens paid to ${message.recipient}.`,message.id);}
  else{next.reserved+=amount;event('queued',`Request ${nonce}: ${formatDemo(amount)} demo tokens entered quarantine.`,message.id);notify('queued',`${formatDemo(amount)} demo tokens requested.\nRecipient: ${message.recipient}\nReview window: 20 seconds. Open your demo to pause or review.`,message.id);}
 }else if(input.action==='pause'){
  if(next.paused)throw Error('Releases are already paused');
  next.paused=true;event('paused','Guardian paused releases.');notify('paused','Guardian paused releases in your demo treasury.');
 }else if(['cancel','execute'].includes(input.action)){
  const message=next.messages.find(item=>item.id===input.messageId);
  if(!message||message.status!=='queued')throw Error('Select a queued request');
  if(input.action==='execute'){
   if(next.paused)throw Error('Guardian pause blocks this payout');
   if(now<message.eligibleAt)throw Error('TooEarly: the demo quarantine has not ended');
   if(next.spent+message.amount>demoPolicy.cap)throw Error('Current window budget is insufficient; wait for the next window');
   if(next.reserved+demoPolicy.reserveFloor>next.balance)throw Error('The treasury must preserve its reserved funds and reserve floor');
   next.balance-=message.amount;next.spent+=message.amount;next.paid+=message.amount;message.status='released';
  }else message.status='cancelled';
  next.reserved-=message.amount;event(message.status,`${message.id}: ${formatDemo(message.amount)} demo tokens ${message.status}.`,message.id);
  notify(message.status,`${message.id}: ${formatDemo(message.amount)} demo tokens ${message.status}.\nTreasury balance: ${formatDemo(next.balance)} demo tokens.`,message.id);
 }else if(input.action==='schedule-resume'){
  if(!next.paused||next.resumeAt!==null)throw Error('Resume requires paused releases and no pending resume');
  next.resumeAt=now+demoPolicy.resumeDelayMs;event('resume-scheduled','Resume scheduled with a 10-second demo policy delay.');
 }else if(input.action==='activate-resume'){
  if(next.resumeAt===null||now<next.resumeAt)throw Error('Wait for the demo policy delay before resuming');
  next.paused=false;next.resumeAt=null;event('resumed','Releases resumed after the demo policy delay.');notify('resumed','Releases resumed in your demo treasury.');
 }else throw Error('Unsupported demo action');
 return {state:next,notifications};
}
