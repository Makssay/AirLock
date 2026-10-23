import {createHash} from 'node:crypto';
import {network} from '../lib/public-network.mjs';

// Fixed, read-only calls. No caller-supplied method, address, key or transaction.
export default async function handler(req,res){
 res.setHeader('Cache-Control','public, s-maxage=30, stale-while-revalidate=60');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Read-only endpoint'});}
 try{
  async function rpc(method,params=[]){
   const r=await fetch(network.rpc,{method:'POST',headers:{'Content-Type':'application/json','User-Agent':'Airlock-Public-Demo/1.0'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(6000)});
   if(!r.ok)throw Error('Testnet RPC unavailable');
   const d=await r.json();if(d.error||d.result==null)throw Error('Testnet RPC unavailable');return d.result;
  }
  if(Number(BigInt(await rpc('eth_chainId')))!==network.chainId)throw Error('Unexpected network identity');
  const block=await rpc('eth_blockNumber');
  const [balance,code]=await Promise.all([rpc('eth_getBalance',[network.contract,block]),rpc('eth_getCode',[network.contract,block])]);
  const verified=createHash('sha256').update(Buffer.from(code.slice(2),'hex')).digest('hex')===network.runtimeSha256;
  if(!verified)throw Error('Contract verification unavailable');
  const units=BigInt(balance),whole=units/10n**18n,fraction=(units%10n**18n).toString().padStart(18,'0').replace(/0+$/,'');
  return res.status(200).json({chainId:network.chainId,contract:network.contract,block:Number(BigInt(block)),balance:`${whole}${fraction?'.'+fraction:''}`,observedAt:new Date().toISOString(),blockTag:'latest',codeVerified:true});
 }catch{return res.status(503).json({error:'Live testnet observation is temporarily unavailable. Recorded demo evidence remains available.'});}
}
