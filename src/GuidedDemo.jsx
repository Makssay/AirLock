import React,{useEffect,useRef,useState} from 'react';
import {ArrowRight,Check,Pause,RotateCcw,Send,Wallet} from 'lucide-react';

const steps=[
 {title:'Connect Telegram',what:'Pair your chat to receive real messages from this walkthrough. If the bot is linked to another demo treasury, alerts move here.',status:'Guardian notifications',value:'Telegram alerts',icon:Send,task:'Open the bot and press Start, or skip this step.',action:'Connect Telegram'},
 {title:'Start with an empty treasury',what:'The treasury holds the tokens Airlock can pay out. Every request is checked against its spending rules.',status:'Available balance',value:'0 demo tokens',icon:Wallet,task:'Add virtual funds so the treasury can pay requests.',action:'Add 50 demo tokens'},
 {title:'Try a routine payout',what:'Small requests can go through immediately when they fit the spending rules.',status:'Available balance',value:'50 demo tokens',icon:Wallet,task:'Send a 0.50-token request to see an ordinary payout.',action:'Request 0.50 tokens'},
 {title:'Send a larger request',what:'The routine payout went through. A request above the instant limit must wait for review.',status:'Routine payout released',value:'0.50 tokens paid',icon:Check,task:'Request 4 tokens to see how quarantine protects the treasury.',action:'Request 4 tokens'},
 {title:'Read the Telegram alert',what:'Airlock put the 4-token request in quarantine. The guardian gets a Telegram alert so they can review the request away from the dashboard.',status:'Telegram preview',value:'Payout request queued',icon:Send,alert:true,task:'Open the request from the example notification.',action:'Review request'},
 {title:'Review the quarantined request',what:'Airlock reserved the funds inside the treasury. The review window gives the guardian time to inspect the recipient.',status:'Quarantined',value:'4 tokens reserved',icon:Pause,task:'Pause releases while you check the unfamiliar request.',action:'Pause releases'},
 {title:'Decide what happens to the request',what:'Releases are paused. The queued tokens still belong to the treasury.',status:'Releases paused',value:'4 tokens reserved',icon:Pause,task:'Cancel this request to free the reserved funds.',action:'Cancel request'},
 {title:'The request was cancelled',what:'The reservation is gone and the same request cannot be used again. The earlier routine payout is already complete.',status:'Cancelled',value:'0 tokens paid on this request',icon:Check,task:'Run the walkthrough again to repeat the scenario.',action:'Restart walkthrough'},
];

export default function GuidedDemo({request}){
 const [index,setIndex]=useState(0);
 const [token,setToken]=useState('');
 const [linked,setLinked]=useState(false);
 const [pairUrl,setPairUrl]=useState('');
 const [waiting,setWaiting]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const requestIds=useRef({});
 const requestId=useRef(null);
 const active=useRef(true);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 useEffect(()=>{
  if(!waiting||!token)return;
  let stopped=false;
  async function check(){
   try{
    const {session}=await request({action:'status'},crypto.randomUUID(),token);
    if(!stopped&&session.telegram.connected){setLinked(true);setWaiting(false);setPairUrl('');}
   }catch{}
  }
  const timer=setInterval(check,3000);
  return ()=>{stopped=true;clearInterval(timer);};
 },[waiting,token]);
 const {title,what,status,value,icon:Icon,task,action,alert}=steps[index];
 const finished=index===steps.length-1;
 const pairing=index===0;

 function send(key,input,auth=token){
  requestIds.current[key]??=crypto.randomUUID();
  return request(input,requestIds.current[key],auth);
 }
 async function connect(){
  const popup=window.open('about:blank','_blank');
  setBusy(true);
  setError('');
  try{
   let auth=token;
   if(!auth){auth=(await send('create',{action:'create'},'')).token;setToken(auth);}
   const {telegramUrl,session}=await send('pair',{action:'telegram-link'},auth);
   delete requestIds.current.pair;
   if(!active.current){popup?.close();return;}
   if(session.telegram.connected){popup?.close();setLinked(true);setWaiting(false);setPairUrl('');return;}
   if(!telegramUrl)throw Error('The link expired. Try connecting again.');
   const url=new URL(telegramUrl);
   if(url.origin!=='https://t.me')throw Error('The Telegram link is invalid.');
   setPairUrl('');
   if(popup&&!popup.closed){popup.opener=null;popup.location.replace(url.href);}
   else setPairUrl(url.href);
   setWaiting(true);
  }catch(err){popup?.close();setError(err.message);}
  finally{setBusy(false);}
 }
 async function skip(){
  setBusy(true);
  setError('');
  try{
   if(token)await send('skip',{action:'telegram-disconnect'});
   setToken('');setLinked(false);setWaiting(false);setPairUrl('');
   setIndex(1);
  }catch(err){setError(err.message);}
  finally{setBusy(false);}
 }
 async function advance(){
  if(pairing&&!linked){await connect();return;}
  setBusy(true);
  setError('');
  try{
   if(finished){
    if(linked)await send('restart',{action:'telegram-disconnect'});
    requestIds.current={};requestId.current=null;
    setToken('');setLinked(false);setIndex(0);return;
   }
   if(linked){
    if(index===1)await send('fund',{action:'fund'});
    if(index===2)await send('normal',{action:'request',scenario:'normal'});
    if(index===3){
     const {session}=await send('suspicious',{action:'request',scenario:'suspicious'});
     requestId.current=session.state.messages.find(message=>message.scenario==='suspicious')?.id;
     if(!requestId.current)throw Error('The quarantined request could not be found.');
    }
    if(index===5)await send('pause',{action:'pause'});
    if(index===6)await send('cancel',{action:'cancel',messageId:requestId.current});
   }
   setIndex(index+1);
  }catch(err){setError(err.message);}
  finally{setBusy(false);}
 }

 return <section className="pg-guided" aria-labelledby="pg-guided-title">
  <div className="pg-intro">
   <p className="pg-eyebrow">Guided simulation · virtual funds</p>
   <h1 id="pg-guided-title">A payout, step by step</h1>
  </div>
  <div className="pg-guided-stage" aria-live="polite">
   <div className="pg-guided-action" key={index}>
    <p className="pg-guided-count">Step {index+1} of {steps.length}</p>
    <h2>{title}</h2>
    <p className="pg-guided-copy">{what}</p>
    <div className="pg-card pg-guided-scene">
     <span className="pg-guided-status"><Icon size={18} aria-hidden="true"/>{pairing&&linked?'Telegram connected':alert&&linked?'Telegram alert requested':status}</span>
     <strong className="pg-guided-value">{value}</strong>
     {alert&&<dl className="pg-guided-alert">
      <div><dt>Amount</dt><dd>4 demo tokens</dd></div>
      <div><dt>Recipient</dt><dd>Unfamiliar recipient</dd></div>
      <div><dt>Review window</dt><dd>20 seconds</dd></div>
     </dl>}
    </div>
    <p className="pg-guided-task">{pairing&&linked?'Your chat is connected. Continue to fund the treasury.':pairing&&waiting?'Press Start in Telegram and return here.':alert&&linked?'Check Telegram for the alert, then review the request.':task}</p>
    {pairing&&pairUrl&&!linked&&<a href={pairUrl} target="_blank" rel="noreferrer">Open Telegram</a>}
   </div>
  </div>
  <div className="pg-guided-buttons">
   <button type="button" className="button primary" disabled={busy} onClick={advance}>
    {pairing&&linked?'Continue':pairing&&waiting?'Open a new Telegram link':action} {finished?<RotateCcw size={16}/>:<ArrowRight size={16}/>}
   </button>
   {pairing&&!linked&&<button type="button" className="button subtle" disabled={busy} onClick={skip}>Skip Telegram</button>}
  </div>
  {error&&<p className="pg-feedback is-error" role="alert">{error}</p>}
 </section>;
}
