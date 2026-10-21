import {ApiPromise,WsProvider} from '@polkadot/api';
import {readFileSync,writeFileSync} from 'node:fs';

// Verify the wallet-submitted result independently before labelling it a deployment.
export async function verifyV3Receipt({transactionHash,blockHash}){
 if(!/^0x[0-9a-f]{64}$/i.test(transactionHash||'')||!/^0x[0-9a-f]{64}$/i.test(blockHash||''))throw Error('Invalid transaction or block hash');
 const plan=JSON.parse(readFileSync('deployments/v3-preparation.local.json','utf8'));
 const provider=new WsProvider(plan.network.substrateRpc,false);let api;
 try{
  let timer;
  try{api=await Promise.race([(async()=>{await provider.connect();return ApiPromise.create({provider,throwOnConnect:true});})(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('V3 verification connection timed out')),30000);})]);}finally{clearTimeout(timer);}
  if(api.genesisHash.toHex()!==plan.network.verification.genesisHash)throw Error('Wrong genesis');
  const block=await api.rpc.chain.getBlock(blockHash);
  const height=block.block.header.number;
  const finalized=await api.rpc.chain.getHeader(await api.rpc.chain.getFinalizedHead());
  if(height.gt(finalized.number)||(await api.rpc.chain.getBlockHash(height)).toHex()!==blockHash)throw Error('Block is not canonical and finalized');
  const index=block.block.extrinsics.findIndex(tx=>tx.hash.toHex()===transactionHash);
  if(index<0)throw Error('Transaction not found in supplied block');
  const tx=block.block.extrinsics[index];
  if(!tx.isSigned||!api.createType('AccountId',tx.signer).eq(api.createType('AccountId',plan.guardian))||tx.method.toHex()!==plan.callData)throw Error('Transaction does not match the prepared guardian deployment');
  const at=await api.at(blockHash);const events=(await at.query.system.events()).filter(e=>e.phase.isApplyExtrinsic&&e.phase.asApplyExtrinsic.toNumber()===index).map(e=>e.event);
  if(!events.some(e=>e.section==='system'&&e.method==='ExtrinsicSuccess')||events.some(e=>e.section==='system'&&e.method==='ExtrinsicFailed'))throw Error('Deployment extrinsic failed');
  const instance=events.find(e=>e.section==='revive'&&e.method==='Instantiated');
  if(!instance)throw Error('No Revive instantiation event');
  const contract=instance.data[1].toString();
  const code=await at.call.reviveApi.code(contract);
  if(code.toHex()!==plan.dryRun.result.ok.result.data)throw Error('Deployed bytecode differs from the reviewed constructor result');
  const evidence={mode:'portaldot-v3-finalized',portaldotDeployment:true,verifiedAt:new Date().toISOString(),genesis:api.genesisHash.toHex(),transactionHash,blockHash,blockNumber:height.toString(),contract,relay:plan.relay,guardian:plan.guardianEvm,events:events.map(e=>({section:e.section,method:e.method,data:e.data.toJSON()}))};
  writeFileSync('deployments/airlock-v3.local.json',JSON.stringify(evidence,null,2));return evidence;
 }finally{if(api)await api.disconnect();else await provider.disconnect();}
}
