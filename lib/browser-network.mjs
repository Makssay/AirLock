import {network} from './public-network.mjs';

// Fixed read-only RPC calls for static hosting. No keys or caller-selected methods.
export async function readBrowserNetwork({fetchImpl=fetch,signal=AbortSignal.timeout(14000)}={}) {
 async function rpc(method,params=[]){
  const response=await fetchImpl(network.rpc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal});
  if(!response.ok)throw Error('RPC unavailable');
  const result=await response.json();if(result.error||result.result==null)throw Error('RPC unavailable');return result.result;
 }
 if(Number(BigInt(await rpc('eth_chainId')))!==network.chainId)throw Error('Unexpected network identity');
 const block=await rpc('eth_blockNumber');
 const [balance,code]=await Promise.all([rpc('eth_getBalance',[network.contract,block]),rpc('eth_getCode',[network.contract,block])]);
 if(!/^0x(?:[a-f0-9]{2})+$/i.test(code))throw Error('Invalid contract code');
 const bytes=Uint8Array.from(code.slice(2).match(/../g),pair=>parseInt(pair,16));
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
 if(digest!==network.runtimeSha256)throw Error('Contract verification unavailable');
 const units=BigInt(balance),whole=units/10n**18n,fraction=(units%10n**18n).toString().padStart(18,'0').replace(/0+$/,'');
 return {chainId:network.chainId,contract:network.contract,block:Number(BigInt(block)),balance:`${whole}${fraction?'.'+fraction:''}`,observedAt:new Date().toISOString(),blockTag:'latest',codeVerified:true};
}
