import React,{useEffect,useRef,useState} from 'react';
import {Bell,Shield,AlertTriangle,ArrowRight} from 'lucide-react';
import {guardianAlerts} from '../lib/guardian-watch.mjs';

export default function GuardianMonitor({data,stale,onReview}){
 const [permission,setPermission]=useState(()=>typeof Notification==='undefined'?'unsupported':Notification.permission);
 const seen=useRef(new Map());
 const alerts=guardianAlerts(data);
 useEffect(()=>{
  if(stale)return;
  for(const alert of alerts){
   if(seen.current.get(alert.key)!==alert.state&&permission==='granted'){
    try{const notification=new Notification('Airlock · request needs review',{body:`${alert.amount} tPOT · ${alert.state}. Open the local console to review.`,tag:alert.key});notification.onclick=()=>{window.focus();onReview(alert.key);notification.close();};}catch{/* In-panel alerts remain available. */}
   }
  }
  seen.current=new Map(alerts.map(alert=>[alert.key,alert.state]));
 },[data.checkedAt,permission,stale]);
 async function enable(){try{setPermission(await Notification.requestPermission());}catch{setPermission('denied');}}
 return <section className={`guardian-monitor panel ${alerts.length?'needs-review':''}`} aria-labelledby="guardian-monitor-title">
  <div className="guardian-monitor-heading"><div><Shield size={20}/><h2 id="guardian-monitor-title">Guardian watch</h2></div><button className="button subtle" disabled={permission!=='default'} onClick={enable}><Bell size={16}/>{permission==='granted'?'Notifications enabled':permission==='denied'?'Notifications blocked':permission==='unsupported'?'In-panel alerts active':'Enable notifications'}</button></div>
  <p role="status">{stale?'Monitoring interrupted — displayed requests may be out of date.':data.historyError?'History is catching up — request coverage is incomplete.':alerts.length?`${alerts.length} queued ${alerts.length===1?'request needs':'requests need'} review.`:'No queued requests at the last verified block.'}</p>
  {alerts.map(alert=><article className="guardian-monitor-request" key={alert.key}><div><strong>{alert.amount} tPOT</strong><span>{alert.state==='paused'?'Releases paused':alert.remainingSeconds>0?`${alert.remainingSeconds}s until eligible at the verified block`:'Eligible for execution — review immediately'}</span><code title={alert.recipient}>{alert.recipient}</code><small>Eligibility: {new Date(alert.eligibleAt).toLocaleString()}</small></div><button className="button danger-outline" onClick={()=>onReview(alert.key)}>Review request <ArrowRight size={15}/></button></article>)}
  <div className="guardian-monitor-foot"><AlertTriangle size={14}/><span>Guardian decisions require confirmation. Keep the console open for browser notifications.</span></div>
 </section>;
}
