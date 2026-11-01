import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Shield,Wallet,Send,Clock3,Pause,Check,RefreshCw,ExternalLink,Copy,AlertTriangle} from 'lucide-react';
import {lane,readDestination,verifyOutbox,inspectSourceStatus,sameAddress,validHash} from '../lib/testnet-lane.mjs';
import {connectSourceWallet,signSourceRequest} from '../lib/testnet-wallet.mjs';
import './playground.css';
import './testnet.css';
const storeKey='airlock-real-testnet-v1';
const api=import.meta.env.BASE_URL==='/'&&typeof location!=='undefined'&&!['localhost','127.0.0.1'].includes(location.hostname)?'/api/testnet':null;
const short=text=>text?text.slice(0,8)+'…'+text.slice(-6):'';
const load=()=>{try{const value=JSON.parse(localStorage.getItem(storeKey)||'{}');return {source:value.source||null,native:value.native||null,history:Array.isArray(value.history)?value.history.slice(-10):[]};}catch{return {source:null,native:null,history:[]};}};
const rejected=error=>error.code===4001||/signature declined/i.test(error.message);
export default function LiveTestnet({onBack}){
 const [saved,setSaved]=useState(load),[snapshot,setSnapshot]=useState(null),[sourceWallet,setSourceWallet]=useState(null),[guardian,setGuardian]=useState(null);
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[stale,setStale]=useState(true),[recover,setRecover]=useState(''),[review,setReview]=useState(null),[clock,setClock]=useState(Date.now());
 const current=useRef(saved),mounted=useRef(true),polling=useRef(false),working=useRef(false),generation=useRef(0);
 function persist(value,required=false){try{localStorage.setItem(storeKey,JSON.stringify(value));}catch{if(required)throw Error('Browser storage is unavailable. Enable storage before requesting a wallet signature.');setError('Browser storage is unavailable. Keep a copy of every transaction hash before leaving this page.');}current.current=value;setSaved(value);}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 async function refresh(){
  if(polling.current)return;polling.current=true;const hash=current.current.source?.hash,fromBlock=current.current.source?.destinationStartBlock,version=generation.current;
  try{
   let result;
   const direct=async()=>{const [destination,source]=await Promise.all([readDestination(),verifyOutbox()]);return {destination,source,request:hash?await inspectSourceStatus(hash,{destination,fromBlock}):null};};
   if(!api)result=await direct();
   else try{const response=await fetch(api+(hash?'?hash='+encodeURIComponent(hash)+(Number.isSafeInteger(fromBlock)?'&from='+fromBlock:''):''),{signal:AbortSignal.timeout(22000)});if(!response.ok)throw Error();result=await response.json();}
   catch{result=await direct();}
   if(mounted.current&&generation.current===version&&hash===current.current.source?.hash){setSnapshot({...result,receivedAt:Date.now()});setStale(false);}
  }catch{if(mounted.current)setStale(true);}finally{polling.current=false;}
 }
 useEffect(()=>{refresh();const timer=setInterval(refresh,9000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{
  if(!sourceWallet?.provider?.on)return;
  const changed=()=>{setSourceWallet(null);setReview(null);setNotice('Wallet changed. Reconnect and review the request.');};
  sourceWallet.provider.on('accountsChanged',changed);sourceWallet.provider.on('chainChanged',changed);
  return()=>{sourceWallet.provider.removeListener?.('accountsChanged',changed);sourceWallet.provider.removeListener?.('chainChanged',changed);};
 },[sourceWallet]);
 async function run(label,fn){if(working.current)return;working.current=true;setBusy(label);setError('');setNotice('');try{await fn();}catch(e){if(mounted.current)setError(e.message||'The wallet action could not be completed');}finally{working.current=false;if(mounted.current){setBusy('');refresh();}}}
 const state=snapshot?.destination,request=snapshot?.request,message=request?.message;
 const fresh=!!snapshot&&!stale&&clock-snapshot.receivedAt<30000;
 const done=message&&['released','cancelled'].includes(message.status);
 const unsettled=!!saved.source&&!done;
 const disabled=!!busy||!fresh||!!saved.native;
 const authorizedSource=sameAddress(sourceWallet?.address,lane.sourceOwner);
 const now=state?state.now+Math.max(0,clock-snapshot.receivedAt):clock;
 const remaining=at=>Math.max(0,Math.ceil((at-now)/1000));
 async function submit(){
  const amount=review?.amount;if(!amount||!authorizedSource||disabled||unsettled)return;
  setReview(null);
  await run('Waiting for Sepolia wallet',async()=>{
   let began=false;
   try{await signSourceRequest(sourceWallet.provider,amount,{
    onSigning:draft=>{began=true;generation.current++;persist({...current.current,source:{...draft,destinationStartBlock:state.finalizedBlock,phase:'signing'}},true);},
    onHash:hash=>{generation.current++;persist({...current.current,source:{...current.current.source,hash,phase:'submitted'}});setNotice('Sepolia request saved. Waiting for six confirmations and the relay.');}
   });}
   catch(e){if(began&&!e.uncertain){generation.current++;persist({...current.current,source:null});}else if(began)persist({...current.current,source:{...current.current.source,phase:'uncertain'}});throw e;}
  });
 }
 async function nativeAction(action){
  if(!guardian||disabled)return;
  await run('Checking guardian action',async()=>{
   const {nativeGuardianAction}=await import('../lib/testnet-guardian.mjs');
   const journal={action,key:message?request.key:null,beforeBlock:state.finalizedBlock,phase:'checking'};
   const result=await nativeGuardianAction(guardian,action,{key:request?.key,policy:state.policy,onStatus:update=>{
    if(update.phase==='wallet'||update.hash)persist({...current.current,native:{...journal,...update}},update.phase==='wallet');
    setBusy(update.phase==='wallet'?'Confirm in guardian wallet':`Guardian transaction · ${update.phase}`);
   }}).catch(e=>{if(rejected(e))persist({...current.current,native:null});throw e;});
   persist({...current.current,native:null,history:[...current.current.history,{kind:'guardian',action,hash:result.hash,at:new Date().toISOString()}].slice(-10)});
   setNotice('Guardian transaction finalized on Portaldot. Refreshing the treasury state.');
  });
 }
 function recoverSource(){
  if(!validHash(recover)||busy)return;generation.current++;persist({...current.current,source:{hash:recover,phase:'recovered'}});setRecover('');setSnapshot(null);setStale(true);refresh();
 }
 async function copy(text){try{await navigator.clipboard.writeText(text);setNotice('Copied.');}catch{setError('Copy is unavailable in this browser. Select the address or hash below.');}}
 return <main className="pg-page tn-page"><header className="pg-header"><a href="#" onClick={e=>{e.preventDefault();onBack();}}><ArrowLeft size={16}/>Airlock home</a><strong><Shield size={22}/>airlock.</strong><span className="pg-mode tn-live">Live testnets · actual transactions</span></header>
  <section className="pg-intro"><p className="pg-eyebrow">Sepolia → Portaldot V3</p><h1>One instruction.<br/>Two real networks.</h1><p>Send a payout request on Sepolia. Follow it into the Portaldot treasury, then review the result as guardian.</p><div className="pg-facts"><span><Wallet size={15}/>Wallet signatures</span><span><Send size={15}/>Guardian Telegram alerts</span><span><Clock3 size={15}/>{state?.policy.delaySeconds||120}s quarantine</span></div><p className="pg-helper">Shared team test treasury · source owner and guardian accounts required to operate. Anyone can inspect the state.</p></section>
  {(error||notice)&&<div className={`pg-feedback ${error?'is-error':''}`} role={error?'alert':'status'}>{error?<AlertTriangle size={18}/>:<Check size={18}/>}<span>{error||notice}</span></div>}
  {!fresh&&<div className="tn-status" role="status"><RefreshCw size={17}/><p>{snapshot?'Connection interrupted. Showing the last observation; signing is disabled until the state is fresh.':'Verifying both testnets and the deployed contracts…'}</p><button className="button subtle" disabled={!!busy} onClick={refresh}>Refresh</button></div>}
  <section className="pg-card tn-path" aria-label="Testnet progress">{[['01','Sepolia request',!!saved.source?.hash],['02','Six confirmations',(request?.confirmations||0)>=6],['03','Accepted on V3',!!message],['04','Reviewed result',!!done]].map(([n,label,complete])=><div key={n}><span>{complete?<Check size={16}/>:n}</span><strong>{label}</strong></div>)}</section>
  <div className="pg-top-grid"><section className="pg-card"><div className="pg-section-title"><h2><Wallet size={19}/>Portaldot treasury</h2><span>{state?state.paused?'Paused':'Active':'Checking'}</span></div><div className="pg-balance">{state?Number(state.balance).toLocaleString('en-US',{maximumFractionDigits:4}):'—'}<small>testnet tPOT</small></div><div className="pg-stat-row"><div><span>Reserved</span><strong>{state?.reserved||'—'}</strong></div><div><span>Finalized block</span><strong>{state?.finalizedBlock.toLocaleString('en-US')||'—'}</strong></div></div><code className="tn-address">{lane.destination}</code><p className="pg-helper">{state?`Code and roles verified · ${new Date(state.checkedAt).toLocaleTimeString()}`:'Checking chain identity, contract code and roles'}</p>{state?.paused&&<p className="tn-callout">Releases are paused. The guardian must schedule and activate resumption before a new source request. Wallet preflight checks the temporary storage deposit and fees.</p>}</section>
  <section className="pg-card"><div className="pg-section-title"><h2><Wallet size={19}/>Source wallet</h2><span>Ethereum Sepolia</span></div><p className="tn-body">The source owner authorizes a payout instruction. Your wallet pays only Sepolia gas; payout funds come from the Portaldot treasury.</p><button className="button primary" disabled={!!busy} onClick={()=>run('Connecting EVM wallet',async()=>setSourceWallet(await connectSourceWallet()))}>{sourceWallet?short(sourceWallet.address):'Connect source wallet'}</button>{sourceWallet&&!authorizedSource&&<p className="tn-callout">This shared outbox accepts its configured owner. Select {short(lane.sourceOwner)} in your wallet.</p>}<p className="pg-helper">Owner: <code className="tn-address">{lane.sourceOwner}</code></p><a className="tn-link" href={'https://sepolia.etherscan.io/address/'+lane.sourceContract} target="_blank" rel="noreferrer">Inspect source contract <ExternalLink size={14}/></a></section></div>
  <section className="pg-card"><div className="pg-section-title"><h2>Choose the live scenario</h2><span>Actual test tokens · no ETH escrow</span></div><div className="pg-scenarios tn-scenarios">{[['0.25','Routine payout','Within the instant threshold.'],['2','Legitimate team payment','Wait for eligibility, then execute.'],['4','Controlled incident','Pause releases and cancel the request.']].map(([amount,title,text])=><button key={amount} disabled={disabled||!authorizedSource||unsettled||state?.paused||!!state?.pendingPolicy} onClick={()=>setReview({amount,title})}><span className="pg-scenario-amount">{amount}<small>tPOT on Portaldot</small></span><strong>{title}</strong><span>{text}</span><ArrowRight size={18}/></button>)}</div><p className="pg-helper">The dedicated relay process must be running. It verifies six canonical Sepolia confirmations and submits the same request on V3.</p>
   {review&&<div className="tn-review"><h3>Review: {review.title}</h3><p>Request {review.amount} tPOT from the shared Portaldot treasury to its configured recipient, {short(lane.guardian)}. Your wallet will sign a zero-value Sepolia contract call.</p><div className="tn-actions"><button className="button primary" disabled={disabled||unsettled||state?.paused} onClick={submit}>Sign Sepolia request</button><button className="button subtle" disabled={!!busy} onClick={()=>setReview(null)}>Back</button></div></div>}
  </section>
  <section className="pg-card"><div className="pg-section-title"><h2>Current request</h2><button className="button subtle" disabled={!!busy} onClick={refresh}><RefreshCw size={15}/>Refresh</button></div>{saved.source?<><p className="tn-body">{saved.source.hash?<a className="tn-link tn-address" href={'https://sepolia.etherscan.io/tx/'+saved.source.hash} target="_blank" rel="noreferrer">{saved.source.hash}<ExternalLink size={14}/></a>:'A wallet signature was requested. Check wallet activity and recover its hash before creating another request.'}</p><p className="tn-outcome" role="status">{message?`${message.amount} tPOT · ${message.status}`:request?.state==='paused'?'Source confirmed · V3 releases paused':request?.state==='ready'?'Source confirmed · waiting for relay':request?`Sepolia confirmations: ${Math.min(request.confirmations,6)} / 6`:saved.source.hash?'Checking the saved transaction…':'Wallet outcome needs review'}</p>{message?.status==='queued'&&<p className="pg-helper">{state.paused?'Paused by guardian':remaining(message.eligibleAt)>0?`${remaining(message.eligibleAt)} seconds left in quarantine`:'Eligible for manual execution, subject to the current policy.'}</p>}{request?.key&&<code className="tn-address">Payout ID: {request.key}</code>}{done&&<button className="button subtle" disabled={!!busy} onClick={()=>{generation.current++;persist({...current.current,source:null,history:[...current.current.history,{kind:'source',hash:saved.source.hash,status:message.status,at:new Date().toISOString()}].slice(-10)});setSnapshot(null);refresh();}}>Prepare another scenario</button>}</>:<p className="pg-helper">A new source transaction will be saved here immediately. Refreshing or reopening the page keeps its hash.</p>}
   <details className="tn-recovery"><summary>Recover a Sepolia request</summary><label htmlFor="tn-hash">Source transaction hash</label><input id="tn-hash" value={recover} onChange={e=>setRecover(e.target.value.trim())} placeholder="0x…" spellCheck="false" autoComplete="off"/><button className="button subtle" disabled={!!busy||!validHash(recover)} onClick={recoverSource}>Inspect this request</button></details>
  </section>
  {request?.state==='rejected'&&<section className="pg-card"><h2>Source request rejected</h2><p role="alert" className="tn-body">{request.reason}. This hash does not authorize a V3 payout.</p><button className="button subtle" disabled={!!busy} onClick={()=>{generation.current++;persist({...current.current,source:null,history:[...current.current.history,{kind:'source',hash:saved.source.hash,status:'rejected',at:new Date().toISOString()}].slice(-10)});setSnapshot(null);refresh();}}>Archive this hash and review a new request</button></section>}
  <section className="pg-card"><div className="pg-section-title"><h2><Shield size={19}/>Native guardian wallet</h2><span>{guardian?'Connected':'Signature stays in your wallet'}</span></div><p className="tn-body">Review and sign treasury actions through the configured Substrate wallet. Every action is simulated again before the signature request.</p><div className="tn-actions"><button className="button primary" disabled={!!busy} onClick={()=>run('Connecting native guardian',async()=>{const {connectGuardian}=await import('../lib/testnet-guardian.mjs');setGuardian(await connectGuardian());})}>{guardian?short(guardian.account.address):'Connect guardian wallet'}</button><button className="button subtle" onClick={()=>copy(lane.guardianNative)}><Copy size={14}/>Copy funding address</button></div><code className="tn-address tn-funding">{lane.guardianNative}</code><p className="pg-helper">Observed EVM balance: {state?.guardianBalance||'—'} tPOT. Native wallet preflight calculates the spendable balance and peak storage separately.</p>
   {guardian&&<div className="tn-actions tn-guardian-actions">{state?.paused?<>{state.pendingPolicy?<button className="button primary" disabled={disabled||remaining(state.pendingPolicy.eligibleAt)>0} onClick={()=>nativeAction('activatePolicy')}>{remaining(state.pendingPolicy.eligibleAt)>0?`Activate resume in ${remaining(state.pendingPolicy.eligibleAt)}s`:'Activate scheduled policy'}</button>:<button className="button primary" disabled={disabled} onClick={()=>nativeAction('resume')}>Schedule resume · {state.policyDelaySeconds}s</button>}</>:<button className="button danger-outline" disabled={disabled||!state} onClick={()=>nativeAction('pause')}><Pause size={15}/>Pause releases</button>}{message?.status==='queued'&&<><button className="button danger-outline" disabled={disabled} onClick={()=>nativeAction('cancel')}>Cancel this request</button><button className="button primary" disabled={disabled||state.paused||remaining(message.eligibleAt)>0} onClick={()=>nativeAction('execute')}>Execute eligible payout</button></>}</div>}
   {saved.native&&<div className="tn-callout"><p>Saved guardian action: {saved.native.action} · {saved.native.phase}. Inspect its outcome and close any pending wallet prompts before another signature.</p>{saved.native.hash&&<code className="tn-address">{saved.native.hash}</code>}<button className="button subtle" disabled={!!busy} onClick={()=>{persist({...current.current,native:null});setNotice('Guardian transaction review acknowledged. Refreshing the chain state.');refresh();}}>I checked the result and closed pending wallet prompts</button></div>}
  </section>
  {request?.transactions?.length>0&&<section className="pg-card"><h2>Portaldot transactions</h2><ul className="tn-history">{request.transactions.map(tx=><li key={tx.hash+tx.event}><span>{tx.event} · finalized block {tx.block}</span><code className="tn-address">{tx.hash}</code><button className="button subtle" onClick={()=>copy(tx.hash)}>Copy transaction hash</button></li>)}</ul><a className="tn-link" href="https://node-console.portaldot.dev/" target="_blank" rel="noreferrer">Open Portaldot node console <ExternalLink size={14}/></a></section>}
  <section className="pg-card tn-alerts"><div><h2><Send size={19}/>Guardian Telegram</h2><p className="tn-body">The independent V3 observer sends real queued-request, pause and payout notifications to the configured guardian chat. Keep the observer host running during this operator demo.</p></div><a className="button subtle" href="https://t.me/airlock_portaldot_bot" target="_blank" rel="noreferrer">Open guardian bot <ExternalLink size={15}/></a></section>
  {saved.history.length>0&&<section className="pg-card"><h2>Saved transaction history</h2><ul className="tn-history">{saved.history.toReversed().map((entry,i)=><li key={i}><span>{entry.action||entry.status}</span><code className="tn-address">{entry.hash}</code></li>)}</ul></section>}
  <footer className="pg-footer"><p>Testnet tokens only. Source requests carry instructions; the Portaldot treasury supplies tPOT. Six Sepolia confirmations are the trusted relay’s acceptance rule.</p><a className="tn-link" href="#try">Open the wallet-free simulation <ArrowRight size={15}/></a></footer>
 </main>;
}
