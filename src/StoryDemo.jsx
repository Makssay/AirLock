import React,{useEffect,useState} from 'react';
import {ArrowLeft,ArrowRight,Shield,Check,ExternalLink} from 'lucide-react';
import {protectionSteps,legitimateSteps} from '../lib/demo-scenarios.mjs';

export function StoryProof({item}){
 const {state,message,operation,local,check}=item;
 return <section className="story-proof" aria-live="polite"><div className={`story-proof-heading ${local?'is-local':''}`}><span><Check size={16}/>{local?'Local Anvil contract evidence':'Finalized Portaldot V3 evidence'}</span><strong>Chain {state.chainId}</strong></div>
  <div className="story-vault"><span>Vault at this recorded step</span><strong>{state.balance} <small>tPOT</small></strong><p>{state.paused?'Releases paused':'Releases active'} · reserved {state.reserved} tPOT</p></div>
  <dl><div><dt>Request</dt><dd>{message.amount} tPOT</dd></div><div><dt>Contract status</dt><dd className="story-message-status">{message.status}</dd></div><div><dt>{check?'Early execution check':local?'Local block':'Finalized block'}</dt><dd>{check?`Rejected · ${check.reason}`:local?state.blockNumber:state.finalizedBlock}</dd></div></dl>
  <details><summary>Inspect {check?'execution check':'transaction evidence'}</summary>{check?<><p>Read-only execution call at local block {check.blockNumber}. The contract returned {check.reason}.</p><p>No transaction was broadcast for this check.</p></>:<><p>{local?'Local transaction':'Destination transaction'}</p><code>{operation.transactionHash||operation.hash}</code></>}<p>{local?'Local contract':'V3 contract'}</p><code>{state.contract}</code>{operation?.source&&<a href={`https://sepolia.etherscan.io/tx/${operation.source.transactionHash}`} target="_blank" rel="noreferrer">Sepolia request <ExternalLink size={13}/></a>}</details>
 </section>;
}

export default function StoryDemo({onBack,evidenceUrl='/api/live/demo',localEvidenceUrl='/api/live/local-demo',backLabel='Control room'}){
 const [reports,setReports]=useState({}),[errors,setErrors]=useState({}),[selection,setSelection]=useState({scenario:'protection',step:0}),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setReports({});setErrors({});
  for(const [scenario,url,project] of [['protection',evidenceUrl,protectionSteps],['legitimate',localEvidenceUrl,legitimateSteps]]){
   fetch(url,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])}).then(response=>{if(!response.ok)throw Error();return response.json();}).then(report=>{
    const steps=project(report);if(!controller.signal.aborted)setReports(previous=>({...previous,[scenario]:steps}));
   }).catch(()=>{if(!controller.signal.aborted)setErrors(previous=>({...previous,[scenario]:'Recorded evidence is unavailable. Try again or open the other scenario.'}));});
  }
  return()=>controller.abort();
 },[evidenceUrl,localEvidenceUrl,attempt]);
 const {scenario,step}=selection,steps=reports[scenario],item=steps?.[step],local=scenario==='legitimate';
 const select=scenario=>setSelection({scenario,step:0});
 return <main className="story-page"><header className="story-header"><a href="#overview" onClick={event=>{event.preventDefault();onBack();}}><ArrowLeft size={17}/>{backLabel}</a><strong><Shield size={21}/>airlock.</strong><span>{local?'Local Anvil scenario':'Recorded V3 walkthrough'}</span></header>
  <section className="story-intro"><p>For teams with a treasury on Portaldot</p><h1>Stop the wrong payout.<br/>Complete the right one.</h1><p>One set of treasury rules. Two paths through quarantine.</p></section>
  <nav className="story-scenarios" aria-label="Choose a payout scenario">{[['protection','Stop a suspicious request','Recorded Portaldot V3'],['legitimate','Complete a legitimate payment','Local Anvil contract run']].map(([key,title,label])=><button key={key} className={scenario===key?'active':''} aria-pressed={scenario===key} onClick={()=>select(key)}><strong>{title}</strong><span>{label}</span></button>)}</nav>
  <p className="story-environment" role="status">{local?'Local Anvil · chain 31337 · local time is advanced to demonstrate the waiting period.':'Portaldot V3 · chain 420420777 · recorded finalized transactions.'}</p>
  {!item?<section className="story-loading" role="status"><p>{errors[scenario]||'Loading recorded evidence…'}</p>{errors[scenario]&&<button className="button subtle" onClick={()=>setAttempt(attempt+1)}>Retry evidence</button>}</section>:<div className="story-layout"><section className="story-explanation"><div className="story-counter">{step+1} / {steps.length} · {local?'Legitimate delayed payout':step===0?'Earlier successful run':'Controlled request'}</div><h2>{item.title}</h2><p>{item.description}</p><nav aria-label="Recorded demo steps" className="story-tabs">{steps.map((entry,index)=><button key={entry.title} aria-label={`Step ${index+1}: ${entry.title}`} aria-current={step===index?'step':undefined} className={step===index?'active':''} onClick={()=>setSelection({scenario,step:index})}>{index+1}</button>)}</nav><div className="story-controls"><button className="button subtle" disabled={step===0} onClick={()=>setSelection({scenario,step:step-1})}><ArrowLeft size={16}/>Previous</button>{step<steps.length-1?<button className="button primary" onClick={()=>setSelection({scenario,step:step+1})}>Next step<ArrowRight size={16}/></button>:<button className="button primary" onClick={()=>select(local?'protection':'legitimate')}>{local?'View V3 protection':'See a legitimate payout'}<ArrowRight size={16}/></button>}</div></section><StoryProof item={item}/></div>}
  <aside className="story-boundary"><strong>Quarantine creates a review window.</strong><p>A guardian can stop an unauthorized request. A legitimate request can execute after its delay, subject to the spending budget, pause state and reserves.</p><details><summary>Architecture and evidence</summary><p>The V3 walkthrough shows the existing deployed contract and its recorded receipts. The legitimate delayed payout is a separate local contract run. The relay trusts configured RPC data; V3 enforces payout rules. Guardian Telegram observation, readiness checks and interrupted-request recovery are implemented in the operator tools.</p><p>The recorded V3 pause occurred after its quarantine delay. The separate local contract checks include a pause before eligibility.</p></details><a href={local?localEvidenceUrl:evidenceUrl} target="_blank" rel="noreferrer">Open {local?'local scenario':'V3'} evidence JSON <ExternalLink size={13}/></a></aside>
 </main>;
}
