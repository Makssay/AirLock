import React,{useEffect,useState} from 'react';
import {Check,Download} from 'lucide-react';
export default function V3Evidence(){
 const [deployment,setDeployment]=useState(null),[run,setRun]=useState(null);
 useEffect(()=>{fetch('/api/v3/receipt').then(r=>r.ok?r.json():null).then(setDeployment).catch(()=>{});fetch('/api/v3/evidence').then(r=>r.ok?r.json():null).then(setRun).catch(()=>{});},[]);
 if(!deployment)return null;
 const receipts=[{label:'Airlock deployment',...deployment},...(run?.receipts||[])];
 return <section className="panel chain-evidence"><div className="section-heading"><div><h2>Portaldot V3 deployment</h2><p>Actual testnet transactions · chain 420420777 · finalized and verified.</p></div><a className="button primary" href={run?'/api/v3/evidence':'/api/v3/receipt'} download="airlock-portaldot-v3-evidence.json"><Download size={15}/>V3 JSON</a></div>
 <div className="chain-summary"><div><span>Deployed contract</span><code>{deployment.contract}</code></div><div><span>Reserve after recorded test</span><strong>{run?`${Number(BigInt(run.vaultBalanceBaseUnits))/1e18} tPOT`:'Test in progress'}</strong></div><div><span>Recorded transactions</span><strong>{receipts.length}</strong></div></div>
 {run&&<div className="v3-message">{run.checks.map(check=><p key={check}><Check size={14}/> {check}</p>)}<p>Recorded end state: releases paused, queue reservations cleared.</p></div>}
 <div className="receipt-list">{receipts.map(r=><article key={r.transactionHash}><span className="receipt-icon ok"><Check size={16}/></span><div><strong>{r.label}</strong><code>{r.transactionHash}</code><p>{r.blockNumber?`Block ${r.blockNumber}`:'Finalized Substrate transaction'}</p></div><span>Finalized</span></article>)}</div>
 <p className="chain-disclaimer">The test relay is trusted to attest messages. This run demonstrates the release firewall on Portaldot V3; it does not prove an external-chain bridge or replace a security audit.</p></section>;
}
