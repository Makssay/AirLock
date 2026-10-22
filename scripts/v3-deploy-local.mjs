import {ApiPromise,WsProvider} from '@polkadot/api';
import {Keyring} from '@polkadot/keyring';
import {cryptoWaitReady} from '@polkadot/util-crypto';
import {parseEnv} from 'node:util';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {prepareV3} from './v3-prepare.mjs';
import {verifyV3Receipt} from '../server/v3-receipt.mjs';

// Guardian secrets are read only by this CLI, never by Express or the frontend.
const EXPECTED_GENESIS='0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd';
const EXPECTED_CHAIN='420420777';
const EXPECTED_GUARDIAN='5HKTe2e7hXWUN6gfreN9dMGQ3TBjqeVbkMzFAFpCaxfvXnQZ';
let api,pair,provider;
try{
 if(existsSync('deployments/airlock-v3.local.json')){console.log('An existing V3 deployment is recorded; no duplicate deployment sent.');process.exitCode=0;}
 else{
  if(!process.argv.includes('--send-testnet'))throw Error('Explicit --send-testnet required');
  if(existsSync('deployments/v3-deploy-submission.local.json'))throw Error('A prior submission journal exists. Recover its transaction before attempting another deployment.');
  const env=parseEnv(readFileSync('.env','utf8'));
  if(!env.SEED)throw Error('Missing SEED in local .env');
  await cryptoWaitReady();
  try{pair=new Keyring({type:'sr25519',ss58Format:42}).addFromUri(env.SEED.trim());}catch{throw Error('Cannot open the local guardian seed');}finally{delete env.SEED;}
  if(pair.address!==EXPECTED_GUARDIAN)throw Error('Local seed does not match the expected guardian');
  const plan=await prepareV3();
  if(plan.network.chainId!==Number(EXPECTED_CHAIN)||plan.network.verification.genesisHash!==EXPECTED_GENESIS)throw Error('Wrong deployment network');
  if(BigInt(plan.budgetBaseUnits)>480n*10n**14n)throw Error('Deployment budget exceeds the 480 tPOT testnet limit');
  provider=new WsProvider(plan.network.substrateRpc,false);await provider.connect();api=await ApiPromise.create({provider,throwOnConnect:true});
  if(api.genesisHash.toHex()!==EXPECTED_GENESIS||api.consts.revive.chainId.toString()!==EXPECTED_CHAIN)throw Error('Connected to wrong network');
  const batch=api.tx.utility.batchAll([api.tx.balances.transferKeepAlive(plan.relayNative,(10n*10n**14n).toString()),api.tx.revive.instantiateWithCode((50n*10n**14n).toString(),plan.weightLimit,plan.storageDepositLimitBaseUnits,plan.creationCode,'0x',null)]);
  if(batch.method.toHex()!==plan.callData)throw Error('Prepared call mismatch');
  const journal={network:'Portaldot V3 testnet',genesis:EXPECTED_GENESIS,guardian:pair.address,startBlock:(await api.rpc.chain.getHeader()).number.toString(),status:'signed',createdAt:new Date().toISOString()};
  await batch.signAsync(pair,{nonce:-1});journal.transactionHash=batch.hash.toHex();
  writeFileSync('deployments/v3-deploy-submission.local.json',JSON.stringify(journal,null,2),{flag:'wx'});
  console.log(JSON.stringify({action:'broadcasting testnet deployment',transactionHash:journal.transactionHash,budgetTPOT:Number(plan.budgetBaseUnits)/1e14}));
  const result=await new Promise((resolve,reject)=>{
   let unsub,done=false;const timer=setTimeout(()=>finish(Error('Finalization timeout: recover the submission journal; do not redeploy')),180000);
   function finish(error,value){if(done)return;done=true;clearTimeout(timer);unsub?.();error?reject(error):resolve(value);}
   batch.send(({status,dispatchError})=>{
    if(status.isInBlock){journal.status='included';journal.blockHash=status.asInBlock.toHex();writeFileSync('deployments/v3-deploy-submission.local.json',JSON.stringify(journal,null,2));}
    if(status.isInvalid||status.isDropped||status.isUsurped)return finish(Error('Transaction not finalized; inspect the submission journal'));
    if(!status.isFinalized)return;
    journal.blockHash=status.asFinalized.toHex();journal.status=dispatchError?'failed':'finalized';writeFileSync('deployments/v3-deploy-submission.local.json',JSON.stringify(journal,null,2));
    if(dispatchError){let reason='Runtime rejected deployment';if(dispatchError.isModule){const e=api.registry.findMetaError(dispatchError.asModule);reason=`${e.section}.${e.name}`;}return finish(Error(reason));}
    finish(null,{transactionHash:journal.transactionHash,blockHash:journal.blockHash});
   }).then(u=>{unsub=u;if(done)u();}).catch(()=>finish(Error('Submission failed; inspect the journal before retrying')));
  });
  const receipt=await verifyV3Receipt(result);console.log(JSON.stringify({status:'independently verified and finalized',contract:receipt.contract,transactionHash:receipt.transactionHash,blockNumber:receipt.blockNumber},null,2));
 }
}catch(e){console.error(e.message);process.exitCode=1;}
finally{pair?.lock();if(api)await api.disconnect();else await provider?.disconnect();}
