import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Shield,Wallet,Send,Clock3,Pause,Check,RefreshCw,AlertTriangle,ExternalLink} from 'lucide-react';
import './playground.css';
const money=value=>(value/100).toFixed(2);
const storageKey='airlock-playground-session-v1';
const api=import.meta.env.BASE_URL==='/'&&typeof location!=='undefined'&&location.hostname!=='127.0.0.1'&&location.hostname!=='localhost'?'/api/playground':'https://airlock-v3-by-makssay-and-kuznets.vercel.app/api/playground';
const scenarios=[['normal','A routine payout','0.50','Within the instant threshold.'],['suspicious','An unfamiliar recipient','4.00','Get the alert, pause and cancel.'],['legitimate','A larger team payment','2.00','Wait, review, then execute.'],['oversized','An oversized instruction','40.00','See the cap reject the request.']];

export default function Playground({onBack}){
 const [token,setToken]=useState(()=>{try{return localStorage.getItem(storageKey)||'';}catch{return '';}});
 const [session,setSession]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[pairUrl,setPairUrl]=useState(''),[offline,setOffline]=useState(false),[clock,setClock]=useState(Date.now()),[expired,setExpired]=useState(false);
 const pending=useRef(null),polling=useRef(false),currentToken=useRef(token),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{currentToken.current=token;},[token]);
 async function request(input,requestId=crypto.randomUUID(),auth=currentToken.current){
  let response,result;
  try{response=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json','X-Request-Id':requestId,...(auth?{'X-Demo-Session':auth}:{})},body:JSON.stringify(input),signal:AbortSignal.timeout(15000)});result=await response.json();}
  catch{throw Object.assign(Error('The demo service could not be reached. You can retry the same action.'),{uncertain:true});}
  if(!response.ok){if(response.status===401&&mounted.current)setExpired(true);throw Object.assign(Error(result.error||'Demo service unavailable'),{uncertain:response.status>=500});}
  return result;
 }
 async function refresh(){if(!currentToken.current||polling.current)return;polling.current=true;try{const result=await request({action:'status'});if(mounted.current){setSession(result.session);setOffline(false);}}catch{if(mounted.current)setOffline(true);}finally{polling.current=false;}}
 useEffect(()=>{if(token)refresh();const timer=setInterval(()=>{if(token)refresh();},3000);return()=>clearInterval(timer);},[token]);
 useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),250);return()=>clearInterval(timer);},[]);
 async function perform(input,retry=false){
  if(busy)return;setBusy(true);setError('');setNotice('');
  const operation=retry&&pending.current?pending.current:{input,requestId:crypto.randomUUID()};pending.current=operation;
  try{
   const result=await request(operation.input,operation.requestId);
   if(!mounted.current)return;
   if(result.token){currentToken.current=result.token;setToken(result.token);try{localStorage.setItem(storageKey,result.token);}catch{}}
   setSession(result.session);setOffline(false);setExpired(false);if(result.telegramUrl)setPairUrl(result.telegramUrl);
   if(operation.input.action==='telegram-disconnect')setPairUrl('');
   pending.current=null;setNotice(operation.input.action==='telegram-link'?'Open your bot below, press Start, then return here.':operation.input.action==='create'?'Your own demo treasury is ready. Add its first funds.':'Demo state updated.');
  }catch(error){if(mounted.current){setError(error.message);if(!error.uncertain)pending.current=null;}}
  finally{if(mounted.current)setBusy(false);}
 }
 async function startOver(){
  if(busy)return;
  if(token&&!expired){setBusy(true);try{await request({action:'telegram-disconnect'});}catch(error){setError(error.message);setBusy(false);return;}setBusy(false);}
  try{localStorage.removeItem(storageKey);}catch{}currentToken.current='';setToken('');setSession(null);setPairUrl('');setExpired(false);pending.current=null;setError('');setNotice('');
 }
 const state=session?.state,queue=state?.messages.filter(message=>message.status==='queued')||[],linked=session?.telegram.connected;

 // Attach a local receipt timestamp only when the server snapshot changes.
 const observed=useRef({server:0,wall:clock});if(session&&observed.current.server!==session.now)observed.current={server:session.now,wall:clock};
 const serverNow=session?session.now+Math.max(0,clock-observed.current.wall):clock;
 const remaining=time=>Math.max(0,Math.ceil((time-serverNow)/1000));
 const notifications=session?.telegram.notifications||[],delivered=notifications.filter(item=>item.status==='delivered').length,pendingCount=notifications.filter(item=>['pending','sending'].includes(item.status)).length;
 const disabled=busy||offline||expired||!!pending.current;
 return <main className="pg-page"><header className="pg-header"><a href="#" onClick={event=>{event.preventDefault();onBack();}}><ArrowLeft size={16}/>Airlock home</a><strong><Shield size={22}/>airlock.</strong><span className="pg-mode">Simulation · virtual funds</span></header>
  <section className="pg-intro"><p className="pg-eyebrow">Try Airlock</p><h1>Your treasury.<br/>Your call.</h1><p>Create a demo treasury, connect Telegram, then decide which payouts get through.</p><div className="pg-facts"><span><Wallet size={15}/>No wallet needed</span><span><Send size={15}/>Real Telegram alerts</span><span><Clock3 size={15}/>20-second demo quarantine</span></div></section>
  {(error||notice)&&<div className={`pg-feedback ${error?'is-error':''}`} role={error?'alert':'status'}>{error?<AlertTriangle size={18}/>:<Check size={18}/>}<span>{error||notice}</span>{pending.current&&!busy&&<button className="button subtle" onClick={()=>perform(pending.current.input,true)}>Retry same action</button>}</div>}
  {offline&&<p className="pg-offline" role="status">Connection interrupted. Last observed balances are shown; actions will resume after a fresh server check.</p>}
  {expired?<section className="pg-start"><h2>Your demo session has ended</h2><p>Demo sessions last one hour. Create another treasury to keep exploring.</p><button className="button primary" onClick={startOver}>Start again</button></section>:!session?<section className="pg-start"><div className="pg-start-icon"><Shield size={35}/></div><h2>A treasury of your own</h2><p>You control the demo funds and guardian actions. Your session is separate from everyone else’s.</p><button className="button primary" disabled={busy||!!pending.current||!!token} onClick={()=>perform({action:'create'})}>{busy?'Creating your treasury…':token?'Checking saved treasury…':'Create demo treasury'}<ArrowRight size={17}/></button>{token&&<button className="button subtle" disabled={busy} onClick={refresh}>Reconnect</button>}</section>:<>
   <ol className="pg-progress" aria-label="Demo journey">{[['Fund treasury',state.funded>0],['Connect Telegram',linked],['Run a request',state.messages.length>0],['Review the result',state.messages.some(message=>['cancelled','released'].includes(message.status))]].map(([label,done],index)=><li key={label} className={done?'done':''}><span>{done?<Check size={14}/>:index+1}</span>{label}</li>)}</ol>
   <div className="pg-top-grid"><section className="pg-card pg-treasury"><div className="pg-section-title"><h2><Wallet size={19}/>Demo treasury</h2><span>{state.paused?'Paused':'Active'}</span></div><div className="pg-balance">{money(state.balance)}<small>demo tokens</small></div><div className="pg-stat-row"><div><span>Paid</span><strong>{money(state.paid)}</strong></div><div><span>Reserved</span><strong>{money(state.reserved)}</strong></div><div><span>Window budget left</span><strong>{money(Math.max(0,500-state.spent))}</strong></div></div><button className="button primary" disabled={disabled||state.funded>=10000} onClick={()=>perform({action:'fund'})}>Add 50 demo tokens</button><p className="pg-helper">Educational balance · no deposit address or real payment.</p></section>
   <section className="pg-card pg-telegram"><div className="pg-section-title"><h2><Send size={19}/>Your Telegram</h2><span className={linked?'connected':''}>{linked?'Connected':'Not connected'}</span></div><p>Receive the request on your phone, then return here to act as guardian.</p>{linked?<><div className="pg-delivery"><Check size={21}/><div><strong>{delivered} notification{delivered===1?'':'s'} delivered</strong><span>{pendingCount?`${pendingCount} waiting for delivery`:'Ready for the next request'}</span></div></div>{notifications.some(item=>item.status==='failed')&&<p role="status">A notification could not be delivered. Check your bot chat or reconnect.</p>}<button className="button subtle" disabled={disabled} onClick={()=>perform({action:'telegram-disconnect'})}>Disconnect Telegram</button></>:<><button className="button primary" disabled={disabled} onClick={()=>perform({action:'telegram-link'})}>Connect Telegram<ArrowRight size={16}/></button>{pairUrl&&<a className="pg-bot-link" href={pairUrl} target="_blank" rel="noreferrer">Open bot and press Start<ExternalLink size={15}/></a>}<p className="pg-helper">The link expires in 5 minutes. Connection is confirmed here after you press Start.</p></>}</section></div>
   <section className="pg-card pg-choose"><div className="pg-section-title"><h2>Choose a payout</h2><span>1.00 instant · 5.00 / minute cap · 5.00 reserve floor</span></div><div className="pg-scenarios">{scenarios.map(([key,title,amount,description])=><button disabled={disabled||state.paused||state.balance===0} key={key} onClick={()=>perform({action:'request',scenario:key})}><span className="pg-scenario-amount">{amount}<small>demo tokens</small></span><strong>{title}</strong><span>{description}</span><ArrowRight size={18}/></button>)}</div>{!linked&&<p className="pg-helper">Connect Telegram first if you want this request delivered to your phone. You can also explore the treasury controls on their own.</p>}</section>
   <section className="pg-card pg-guardian"><div className="pg-section-title"><h2><Shield size={19}/>You are the guardian</h2>{!state.paused&&<button className="button danger-outline" disabled={disabled} onClick={()=>perform({action:'pause'})}><Pause size={15}/>Pause releases</button>}</div>{state.paused&&<div className="pg-pause-state"><strong>Releases are paused. Queued funds stay in the treasury.</strong>{state.resumeAt===null?<button className="button subtle" disabled={disabled} onClick={()=>perform({action:'schedule-resume'})}>Schedule resume · 10s</button>:<button className="button primary" disabled={disabled||remaining(state.resumeAt)>0} onClick={()=>perform({action:'activate-resume'})}>{remaining(state.resumeAt)>0?`Resume in ${remaining(state.resumeAt)}s`:'Activate resume'}</button>}</div>}{queue.length===0?<p className="pg-helper">No requests are waiting. Choose a larger payout above to open a review window.</p>:queue.map(message=><article className="pg-request" key={message.id}><div><span className="pg-request-id">{message.id} · {message.recipient}</span><h3>{money(message.amount)} <small>demo tokens</small></h3><p>{state.paused?'Paused by guardian':remaining(message.eligibleAt)>0?`${remaining(message.eligibleAt)}s left in quarantine`:'Eligible · review before executing'}</p></div><div className="pg-request-actions"><button className="button primary" disabled={disabled||state.paused} onClick={()=>perform({action:'execute',messageId:message.id})}>{remaining(message.eligibleAt)>0?'Try early execution':'Execute payout'}</button><button className="button danger-outline" disabled={disabled} onClick={()=>perform({action:'cancel',messageId:message.id})}>Cancel request</button></div></article>)}</section>
   <section className="pg-card pg-events"><div className="pg-section-title"><h2>Your demo activity</h2><span>Server-checked actions</span></div>{state.events.length===0?<p className="pg-helper">Your story starts with the first funding action.</p>:<ol>{state.events.toReversed().slice(0,16).map(event=><li key={event.id}><span className={`pg-event-dot ${event.type}`}/><div><strong>{event.text}</strong><time>{new Date(event.at).toLocaleTimeString()}</time></div></li>)}</ol>}</section>
   <footer className="pg-footer"><p>This simulation uses virtual tokens and shortened demo timings. Recorded V3 receipts are available in the separate evidence walkthrough.</p><button className="button subtle" disabled={busy} onClick={startOver}>Start a new demo</button></footer>
  </>}
 </main>;
}
