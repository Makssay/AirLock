import React,{useEffect,useState} from 'react';
import {ArrowRight,Check,Clock3,Pause,Play,RotateCcw,Shield,Wallet} from 'lucide-react';

const steps=[
 {title:'Fund the treasury',status:'50 demo tokens available',icon:Wallet,what:'The team sets aside 50 tokens for payouts.',why:'Airlock checks each request against the funds and spending rules in this treasury.'},
 {title:'Release a routine payout',status:'0.50 tokens paid',icon:Check,what:'The contract releases a small request within the spending limits.',why:'Routine payments can go through immediately.'},
 {title:'Quarantine an unfamiliar request',status:'4 tokens reserved',icon:Clock3,what:'A 4-token request exceeds the instant limit. The funds stay in the treasury during a 20-second review window.',why:'The delay gives the guardian time to check the recipient before funds can leave.'},
 {title:'Notify the guardian',status:'Example Telegram alert',icon:Shield,what:'The alert shows the amount and time left to review. The guardian pauses releases while checking the request.',why:'The guardian can intervene even if the relay that sent the request is compromised.'},
 {title:'Cancel the request',status:'4 tokens cancelled · 0 paid on this request',icon:Check,what:'The guardian cancels the request. The reserved funds become available to the treasury again.',why:'The contract records the cancellation and rejects reuse of the same request.'},
];

export default function GuidedDemo(){
 const [index,setIndex]=useState(0);
 const [playing,setPlaying]=useState(false);
 const last=index===steps.length-1;
 useEffect(()=>{
  if(!playing||last)return;
  const timer=setTimeout(()=>setIndex(index+1),8000);
  return ()=>clearTimeout(timer);
 },[playing,index,last]);
 function go(next){setPlaying(false);setIndex(next);}
 const {title,status,icon:Icon,what,why}=steps[index];

 return <section className="pg-guided" aria-labelledby="pg-guided-title">
  <div className="pg-intro">
   <p className="pg-eyebrow">Guided simulation</p>
   <h1 id="pg-guided-title">A payout, step by step</h1>
   <p>Follow two requests through Airlock. This walkthrough uses virtual funds and an example Telegram alert.</p>
  </div>
  <div className="pg-guided-layout">
   <ol className="pg-guided-track" aria-label="Walkthrough steps">{steps.map((step,i)=><li key={step.title}><button type="button" aria-current={i===index?'step':undefined} onClick={()=>go(i)}><span>{i+1}</span>{step.title}</button></li>)}</ol>
   <article className="pg-card pg-guided-scene" aria-live={playing&&!last?'off':'polite'}>
    <div className="pg-guided-action" key={index}>
     <span className="pg-guided-status"><Icon size={18} aria-hidden="true"/>{status}</span>
     <h2>{title}</h2>
     <p>{what}</p>
     <p><strong>Why it matters</strong> {why}</p>
    </div>
   </article>
  </div>
  <div className="pg-guided-controls">
   <button type="button" className="button subtle" disabled={index===0} onClick={()=>go(index-1)}>Previous</button>
   <button type="button" className="button subtle" onClick={()=>{if(last){setIndex(0);setPlaying(true);}else setPlaying(!playing);}}>{last?<RotateCcw size={16}/>:playing?<Pause size={16}/>:<Play size={16}/>} {last?'Replay':playing?'Pause':'Play walkthrough'}</button>
   <button type="button" className="button primary" disabled={last} onClick={()=>go(index+1)}>Next step <ArrowRight size={16}/></button>
  </div>
 </section>;
}
