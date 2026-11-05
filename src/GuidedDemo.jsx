import React,{useState} from 'react';
import {ArrowRight,Check,Pause,RotateCcw,Send,Wallet} from 'lucide-react';

const steps=[
 {title:'Start with an empty treasury',what:'The treasury holds the tokens Airlock can pay out. Every request is checked against its spending rules.',status:'Available balance',value:'0 demo tokens',icon:Wallet,task:'Add virtual funds so the treasury can pay requests.',action:'Add 50 demo tokens'},
 {title:'Try a routine payout',what:'Small requests can go through immediately when they fit the spending rules.',status:'Available balance',value:'50 demo tokens',icon:Wallet,task:'Send a 0.50-token request to see an ordinary payout.',action:'Request 0.50 tokens'},
 {title:'Send a larger request',what:'The routine payout went through. A request above the instant limit must wait for review.',status:'Routine payout released',value:'0.50 tokens paid',icon:Check,task:'Request 4 tokens to see how quarantine protects the treasury.',action:'Request 4 tokens'},
 {title:'Read the Telegram alert',what:'Airlock put the 4-token request in quarantine. The guardian gets a Telegram alert so they can review the request away from the dashboard.',status:'Telegram preview',value:'Payout request queued',icon:Send,alert:true,task:'Open the request from the example notification.',action:'Review request'},
 {title:'Review the quarantined request',what:'Airlock reserved the funds inside the treasury. The review window gives the guardian time to inspect the recipient.',status:'Quarantined',value:'4 tokens reserved',icon:Pause,task:'Pause releases while you check the unfamiliar request.',action:'Pause releases'},
 {title:'Decide what happens to the request',what:'Releases are paused. The queued tokens still belong to the treasury.',status:'Releases paused',value:'4 tokens reserved',icon:Pause,task:'Cancel this request to free the reserved funds.',action:'Cancel request'},
 {title:'The request was cancelled',what:'The reservation is gone and the same request cannot be used again. The earlier routine payout is already complete.',status:'Cancelled',value:'0 tokens paid on this request',icon:Check,task:'Run the walkthrough again to repeat the scenario.',action:'Restart walkthrough'},
];

export default function GuidedDemo(){
 const [index,setIndex]=useState(0);
 const {title,what,status,value,icon:Icon,task,action,alert}=steps[index];
 const finished=index===steps.length-1;

 return <section className="pg-guided" aria-labelledby="pg-guided-title">
  <div className="pg-intro">
   <p className="pg-eyebrow">Guided simulation · virtual funds</p>
   <h1 id="pg-guided-title">A payout, step by step</h1>
  </div>
  <div aria-live="polite">
   <div className="pg-guided-action" key={index}>
    <p className="pg-guided-count">Step {index+1} of {steps.length}</p>
    <h2>{title}</h2>
    <p className="pg-guided-copy">{what}</p>
    <div className="pg-card pg-guided-scene">
     <span className="pg-guided-status"><Icon size={18} aria-hidden="true"/>{status}</span>
     <strong className="pg-guided-value">{value}</strong>
     {alert&&<dl className="pg-guided-alert">
      <div><dt>Amount</dt><dd>4 demo tokens</dd></div>
      <div><dt>Recipient</dt><dd>Unfamiliar recipient</dd></div>
      <div><dt>Review window</dt><dd>20 seconds</dd></div>
     </dl>}
    </div>
    <p className="pg-guided-task">{task}</p>
   </div>
  </div>
  <button type="button" className="button primary" onClick={()=>setIndex(finished?0:index+1)}>
   {action} {finished?<RotateCcw size={16}/>:<ArrowRight size={16}/>}
  </button>
 </section>;
}
