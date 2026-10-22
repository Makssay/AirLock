import React,{useEffect,useState} from 'react';
import {Shield,Check,Clock3,ExternalLink} from 'lucide-react';
export default function AttackDemo(){
 const [report,setReport]=useState(null),[quote,setQuote]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 useEffect(()=>{let mounted=true;const load=async()=>{try{const r=await fetch('/api/live/demo');if(!r.ok)throw Error('Demo evidence unavailable');const s=await r.json();if(mounted){setReport(s);setError('');}}catch(e){if(mounted)setError(e.message);}};load();const t=setInterval(load,4000);return()=>{mounted=false;clearInterval(t);};},[]);
 async function estimate(){setLoading(true);setError('');try{const r=await fetch('/api/live/demo-quote',{signal:AbortSignal.timeout(45000)}),s=await r.json();if(!r.ok)throw Error(s.error);setQuote(s);}catch(e){setError(e.message);}finally{setLoading(false);}}
 const complete=report?.status==='completed';
 const steps=[['Normal payout · earlier run',!!report?.baseline,report?.baseline?.transactionHash],['4 tPOT held in quarantine',!!report?.quarantined,report?.operations.find(o=>o.input.action==='submit')?.transactionHash],['Guardian pauses releases',!!report?.paused,report?.operations.findLast(o=>o.input.action==='pause'&&o.status==='finalized')?.transactionHash],['Guardian cancels request',complete,report?.operations.find(o=>o.input.action==='cancel')?.transactionHash]];
 return <section className="panel controlled-demo"><div className="section-heading"><div><h2><Shield size={19}/>A relay goes rogue. The vault holds.</h2><p>Controlled public testnet scenario · fixed 4 tPOT request to the guardian</p></div><span className="count-chip">{complete?'Verified on V3':report?.status||'Ready for preflight'}</span></div>
 <ol className="demo-steps">{steps.map(([label,done,hash])=><li key={label} className={done?'done':''}>{done?<Check size={18}/>:<Clock3 size={18}/>}<span>{label}</span>{hash&&<details><summary>Transaction hash</summary><code>{hash}</code></details>}</li>)}</ol>
 {report?.metrics&&<div className="demo-metrics">{[['Paid during this scenario',report.metrics.paidDuringDemo],['Quarantined → cancelled',report.metrics.cancelled],['Vault after response',report.metrics.vaultAfter]].map(([label,value])=><div key={label}><span>{label}</span><strong>{Number(value).toLocaleString('en-US')} <small>tPOT</small></strong></div>)}</div>}
 {complete&&<p className="helper">Ended {new Date(report.completedAt).toLocaleString()}. Releases remain paused; resuming requires the 300-second policy delay. Live vault balance is shown above.</p>}
 <p className="helper">The normal payout comes from an earlier confirmed run. This scenario demonstrates one cancelled request; it does not measure total loss avoided. Source events use a trusted RPC relay and six confirmations.</p>
 {report?.recoveryNote&&<p className="helper">{report.recoveryNote}</p>}
 {report?.error&&<p role="alert" className="inline-reason">Stopped: {report.error}. Inspect saved transactions before retrying.</p>}
 <div className="demo-actions">{!complete&&<button className="button subtle" disabled={loading} onClick={estimate}>{loading?'Estimating…':'Estimate V3 demo cost'}</button>}{report&&<a className="button subtle" href="/api/live/demo" target="_blank" rel="noreferrer">Inspect demo evidence <ExternalLink size={14}/></a>}</div>
 {quote&&<p role="status" className="helper">V3 relay maximum estimate: {Number(quote.relayUpperFee).toFixed(4)} tPOT · top-up: {quote.topup} tPOT · {quote.reason}. {quote.note}</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
