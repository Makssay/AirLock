import {ApiPromise,WsProvider} from '@polkadot/api';
import {decodeAddress} from '@polkadot/util-crypto';
import {lane,guardianActionData,sameAddress} from './testnet-lane.mjs';
import {network} from './public-network.mjs';
import {matchesV3RuntimeHash} from './v3-code.mjs';
import {guardianFundingRequired} from './guardian-watch.mjs';
const N=10n**14n;
const sameNative=(a,b)=>{try{return decodeAddress(a).toString()===decodeAddress(b).toString();}catch{return false;}};
export async function connectGuardian(extensions=globalThis.injectedWeb3){
 if(!extensions||!Object.keys(extensions).length)throw Error('Install or enable a Substrate-compatible wallet extension, then reload this page');
 for(const [name,extension] of Object.entries(extensions)){
  let wallet;try{wallet=await extension.enable('Airlock live testnet');}catch{continue;}
  const account=(await wallet.accounts.get()).find(a=>sameNative(a.address,lane.guardianNative));
  if(account)return {name,account,signer:wallet.signer};
 }
 throw Error('The existing V3 guardian account was not shared by a wallet. Select it in your extension');
}
export async function nativeGuardianAction(wallet,action,{key,policy,onStatus=()=>{}}={}){
 if(!sameNative(wallet?.account?.address,lane.guardianNative)||!wallet.signer)throw Error('Connect the configured native guardian wallet');
 const data=guardianActionData(action,{key,policy});
 const provider=new WsProvider(lane.nativeWs,false);let api,timer,connecting,expired=false;
 try{
  api=await Promise.race([(async()=>{await provider.connect();if(expired)throw Error('Portaldot wallet connection timed out');connecting=new ApiPromise({provider,throwOnConnect:true});return connecting.isReadyOrError;})(),new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Error('Portaldot wallet connection timed out'));},25000);})]);
  clearTimeout(timer);
  if(api.genesisHash.toHex()!==lane.genesis||Number(api.consts.revive.chainId.toString())!==lane.destinationChainId)throw Error('Portaldot identity mismatch; signing stopped');
  if(!sameAddress((await api.call.reviveApi.address(wallet.account.address)).toString(),lane.guardian))throw Error('Guardian address mapping changed');
  const code=(await api.call.reviveApi.code(lane.destination)).toU8a(true);
  if(!await matchesV3RuntimeHash(code,network.runtimeSha256))throw Error('Treasury code could not be verified');
  const dry=await api.call.reviveApi.call(wallet.account.address,lane.destination,0,null,null,data);
  const peak=dry.maxStorageDeposit.isCharge?BigInt(dry.maxStorageDeposit.asCharge.toString()):0n;
  const net=dry.storageDeposit.isCharge?BigInt(dry.storageDeposit.asCharge.toString()):0n;
  if(dry.result.isErr){
   let reason='The runtime rejected this action';
   if(dry.result.asErr.isModule){const e=api.registry.findMetaError(dry.result.asErr.asModule);reason=e.section+'.'+e.name;}
   throw Error(reason.includes('StorageDepositNotEnoughFunds')?`Guardian needs a temporary storage deposit of ${Number(peak)/Number(N)} tPOT plus fees. Add test tokens to the guardian wallet, then refresh.`:reason);
  }
  if((Number(dry.toJSON().result.ok.flags.bits)&1)!==0)throw Error('The treasury rejected this action. Refresh its policy, pause and payout status');
  if(peak>12n*N||net>12n*N)throw Error('The storage estimate exceeds this operator run’s 12 tPOT limit');
  const weight={refTime:(BigInt(dry.weightRequired.refTime.toString())*125n/100n).toString(),proofSize:(BigInt(dry.weightRequired.proofSize.toString())*125n/100n).toString()};
  const tx=api.tx.revive.call(lane.destination,0,weight,((peak>net?peak:net)+N).toString(),data);
  const [info,account]=await Promise.all([tx.paymentInfo(wallet.account.address),api.query.system.account(wallet.account.address)]);
  const fee=BigInt(info.partialFee.toString()),available=BigInt(account.data.free.toString())-BigInt(account.data.frozen.toString());
  if(fee>N||available<guardianFundingRequired({peakDeposit:peak,netDeposit:net,fee,margin:N/10n}))throw Error('Guardian balance does not cover peak storage, fees and the remaining margin');
  onStatus({phase:'wallet',action});
  return await new Promise((resolve,reject)=>{
   let unsubscribe,finished=false;
   const finish=(error,value)=>{if(finished)return;finished=true;clearTimeout(timer);unsubscribe?.();error?reject(error):resolve(value);};
   timer=setTimeout(()=>finish(Object.assign(Error('Confirmation timed out. Inspect the saved native transaction hash before another action'),{uncertain:true})),180000);
   tx.signAndSend(wallet.account.address,{signer:wallet.signer},result=>{
    if(finished)return;
    const hash=result.txHash?.toHex();onStatus({phase:result.status.type,hash,action});
    if(result.dispatchError)return finish(Object.assign(Error('The native transaction failed. Its hash is saved for inspection'),{hash}));
    if(result.status.isFinalized)return finish(null,{hash,finalizedHash:result.status.asFinalized.toHex()});
    if(result.status.isInvalid||result.status.isDropped||result.status.isUsurped)return finish(Object.assign(Error('Native transaction outcome needs inspection before another action'),{uncertain:true,hash}));
   }).then(stop=>{unsubscribe=stop;if(finished)stop();}).catch(error=>finish(Object.assign(Error(error.code===4001?'Wallet signature declined':'Wallet signing failed. Inspect wallet activity before retrying'),{uncertain:error.code!==4001})));
  });
 }finally{expired=true;clearTimeout(timer);if(api||connecting)await (api||connecting).disconnect();else await provider.disconnect();}
}
