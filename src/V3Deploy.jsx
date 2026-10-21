import React, {useEffect,useState} from 'react';
import {Shield,Check,Wallet,RefreshCw,ArrowRight,Download} from 'lucide-react';

const tokens=value=>(Number(BigInt(value))/1e14).toLocaleString('en-US',{maximumFractionDigits:4});
export default function V3Deploy(){
 const [plan,setPlan]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[wallets,setWallets]=useState([]),[walletName,setWalletName]=useState(''),[extension,setExtension]=useState(null),[receipt,setReceipt]=useState(null);
 useEffect(()=>{fetch('/api/v3/preparation').then(r=>r.ok?r.json():null).then(setPlan).catch(()=>{});fetch('/api/v3/receipt').then(r=>r.ok?r.json():null).then(setReceipt).catch(()=>{});},[]);
 async function refresh(){setBusy(true);setError('');setExtension(null);try{const r=await fetch('/api/v3/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const p=await r.json();if(!r.ok)throw Error(p.error);setPlan(p);setMessage('Live constructor simulation passed. No transaction sent.');}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function discover(){const names=Object.keys(window.injectedWeb3||{});setWallets(names);setWalletName(names[0]||'');if(!names.length)setError('Open this page in the browser with your Substrate wallet extension installed (for example Talisman or Polkadot.js).');}
 async function connect(){setBusy(true);setError('');try{
  const injected=await window.injectedWeb3[walletName].enable('Airlock — Portaldot V3 testnet');
  const {decodeAddress}=await import('@polkadot/util-crypto');const {u8aEq}=await import('@polkadot/util');
  const accounts=await injected.accounts.get();const account=accounts.find(a=>u8aEq(decodeAddress(a.address),decodeAddress(plan.guardian)));
  if(!account)throw Error('Allow the guardian account 5HKTe2…fvXnQZ in your wallet, then connect again.');
  setExtension({injected,account});setMessage('Guardian connected. Review the amounts, then request the deployment signature.');
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 async function deploy(){setBusy(true);setError('');let api,unsub;
 try{
  if(!extension||!plan)throw Error('Connect the guardian first.');
  if(Date.now()-Date.parse(plan.checkedAt)>300000)throw Error('Preparation expired. Refresh the simulation and reconnect.');
  const {ApiPromise,WsProvider}=await import('@polkadot/api');
  setMessage('Checking the network before requesting your signature…');
  const provider=new WsProvider(plan.network.substrateRpc,false);
  let timer;
  try{api=await Promise.race([(async()=>{await provider.connect();return ApiPromise.create({provider,throwOnConnect:true});})(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('V3 connection timed out. No transaction sent.')),30000);})]);}catch(e){await provider.disconnect();throw e;}finally{clearTimeout(timer);}
  if(api.genesisHash.toHex()!==plan.network.verification.genesisHash||api.consts.revive.chainId.toString()!==String(plan.network.chainId))throw Error('Wrong network. Deployment stopped.');
  if(api.runtimeVersion.specVersion.toString()!=='3002')throw Error('Runtime changed. Refresh and verify the deployment before signing.');
  const batch=api.tx.utility.batchAll([
   api.tx.balances.transferKeepAlive(plan.relayNative,(BigInt(plan.relayFundingTokens)*10n**14n).toString()),
   api.tx.revive.instantiateWithCode((BigInt(plan.vaultTokens)*10n**14n).toString(),plan.weightLimit,plan.storageDepositLimitBaseUnits,plan.creationCode,'0x',null)
  ]);
  if(batch.method.toHex()!==plan.callData)throw Error('Prepared call does not match the reviewed deployment.');
  const account=await api.query.system.account(plan.guardian);
  if(BigInt(account.data.free.toString())-BigInt(account.data.frozen.toString())<BigInt(plan.budgetBaseUnits))throw Error('Guardian balance is below the reviewed budget.');
  setMessage('Confirm the testnet deployment in your wallet.');
  const result=await new Promise((resolve,reject)=>{
   let settled=false;const timer=setTimeout(()=>finish(Error('Finalization was not observed within 3 minutes. Do not resubmit until the transaction is checked on chain.')),180000);
   function finish(error,value){if(settled)return;settled=true;clearTimeout(timer);unsub?.();error?reject(error):resolve(value);}
   batch.signAndSend(extension.account.address,{signer:extension.injected.signer},({status,events,dispatchError,txHash})=>{
    if(status.isInvalid||status.isDropped||status.isUsurped)return finish(Error(`Transaction ${status.type}; check its status before retrying.`));
    if(status.isInBlock)setMessage('Included in a block. Waiting for finality…');
    if(!status.isFinalized)return;
    if(dispatchError){let reason=dispatchError.toString();if(dispatchError.isModule){const e=api.registry.findMetaError(dispatchError.asModule);reason=`${e.section}.${e.name}`;}return finish(Error(reason));}
    const instantiated=events.find(({event})=>event.section==='revive'&&event.method==='Instantiated');
    if(!instantiated)return finish(Error('Finalized without a Revive Instantiated event. Check the transaction before retrying.'));
    finish(null,{mode:'portaldot-v3-finalized',genesis:api.genesisHash.toHex(),transactionHash:txHash.toHex(),blockHash:status.asFinalized.toHex(),contract:instantiated.event.data[1].toString(),relay:plan.relay,guardian:plan.guardianEvm,events:events.map(({event})=>({section:event.section,method:event.method,data:event.data.toJSON()}))});
   }).then(u=>{unsub=u;if(settled)u();}).catch(e=>finish(e));
  });
  setReceipt(result);setMessage('Airlock deployment finalized on Portaldot V3. Verifying and saving the receipt…');
  try{const response=await fetch('/api/v3/receipt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transactionHash:result.transactionHash,blockHash:result.blockHash})});const saved=await response.json();if(!response.ok)throw Error(saved.error);setReceipt(saved);setMessage('Finalized on Portaldot V3. Receipt independently verified and saved.');}
  catch(e){setError(`Deployment finalized, but saving the receipt failed: ${e.message}. Download the receipt; do not deploy again.`);}
 }catch(e){setError(e.message);}finally{unsub?.();await api?.disconnect();setBusy(false);}
 }
 function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(receipt,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='airlock-v3-finalized.json';a.click();URL.revokeObjectURL(url);}
 return <section className="panel v3-deploy"><div className="section-heading"><div><div className="heading-context"><Shield size={16}/>Portaldot V3 testnet</div><h2>Deploy Airlock</h2><p>Your wallet controls the guardian. The separate test relay stays on this computer.</p></div><button className="button subtle" disabled={busy||!!receipt} onClick={refresh}><RefreshCw size={15}/>Refresh simulation</button></div>
 {error&&<p className="v3-alert" role="alert">{error}</p>}{message&&<p role="status" className="v3-message">{message}</p>}
 {!plan?<p>Prepare the deployment with “Refresh simulation”.</p>:<>
 <div className="chain-summary"><div><span>Network identity verified</span><strong>Portaldot V3 · {plan.network.chainId}</strong></div><div><span>Guardian balance at check</span><strong>{tokens(plan.availableBaseUnits)} tPOT</strong></div><div><span>Contract simulation</span><strong><Check size={15}/> Passed · no transaction sent</strong></div></div>
 <div className="policy-values">{[['Airlock reserve',`${plan.vaultTokens} tPOT`],['Test relay funding',`${plan.relayFundingTokens} tPOT`],['Expected storage deposit',`${tokens(plan.storageDepositBaseUnits)} tPOT`],['Storage deposit limit',`${tokens(plan.storageDepositLimitBaseUnits)} tPOT`],['Estimated network fee',`${tokens(plan.estimatedFeeBaseUnits)} tPOT`],['Budget incl. fee margin',`${tokens(plan.budgetBaseUnits)} tPOT`]].map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>
 <p className="helper">The storage deposit is locked by the network separately from the reserve. Funding and deployment use one atomic transaction. The relay is a local test wallet; the testnet reserve is for this demonstration.</p>
 <div className="v3-address"><span>Guardian</span><code>{plan.guardian}</code><span>Test relay</span><code>{plan.relay}</code></div>
 <p className="helper">Release policy: instant up to 1 tPOT; total 5 tPOT per 10-minute window; quarantine 120 seconds; reserve floor 5 tPOT.</p>
 {!receipt&&<div className="v3-actions">{!wallets.length?<button className="button subtle" disabled={busy} onClick={discover}><Wallet size={16}/>Find my wallet</button>:<><select aria-label="Wallet extension" value={walletName} onChange={e=>{setWalletName(e.target.value);setExtension(null);}}>{wallets.map(w=><option key={w}>{w}</option>)}</select><button className="button subtle" disabled={busy} onClick={connect}><Wallet size={16}/>Connect guardian</button></>}<button className="button primary" disabled={busy||!extension} onClick={deploy}>Sign & deploy on V3 <ArrowRight size={16}/></button></div>}
 {receipt&&<div className="v3-address"><strong>Finalized contract</strong><code>{receipt.contract}</code><span>Transaction</span><code>{receipt.transactionHash}</code><button className="button primary" onClick={download}><Download size={15}/>Download finalized receipt</button></div>}
 <p className="helper">Last simulation: {new Date(plan.checkedAt).toLocaleString()}. Signing requires your wallet extension. Your seed phrase is never requested.</p>
 </>}
 </section>;
}
