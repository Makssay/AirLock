import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { cryptoWaitReady, decodeAddress } from '@polkadot/util-crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { configuration, submission, messageCall, messageKey, decodeState, units, hex, DOMAIN, ERRORS } from '../lib/abi.mjs';

const [command='probe',...args]=process.argv.slice(2);
const option=(name,fallback)=>{const i=args.indexOf(`--${name}`);return i<0?fallback:args[i+1];};
const endpoint=option('endpoint','ws://127.0.0.1:9944');
const provider=new WsProvider(endpoint,false); // No reconnect loop for a missing node.
let api;
const timeout=setTimeout(()=>{console.error('RPC connection timed out. Start a Portaldot node or provide --endpoint.');provider.disconnect();process.exitCode=1;},15000);
try {
 await provider.connect();
 api=await ApiPromise.create({provider,types:{LookupSource:'MultiAddress'},throwOnConnect:true});clearTimeout(timeout);
 const chain=(await api.rpc.system.chain()).toString(),chainType=(await api.rpc.system.chainType()).toString();
 const genesis=api.genesisHash.toHex(),version=api.runtimeVersion.toHuman();
 const calls=Object.keys(api.tx.contracts||{});
 const info={endpoint,chain,chainType,genesis,runtime:version,contractCalls:calls};
 console.log(JSON.stringify(info,null,2));
 if(command==='probe') {
  mkdirSync('deployments',{recursive:true});writeFileSync('deployments/probe.local.json',JSON.stringify(info,null,2));
 }else{
  if(!['deploy','demo'].includes(command))throw Error('Use probe, deploy or demo');
  if(/mainnet/i.test(chain) || !['Development','Local'].includes(chainType))throw Error('Dev signing is restricted to Development/Local chains. Mainnet and live networks are blocked.');
  const local=/^(ws|wss):\/\/(127\.0\.0\.1|localhost|\[::1\])(?=[:/]|$)/.test(endpoint);
  if(!local && (!args.includes('--allow-remote-dev') || option('expected-genesis')!==genesis))throw Error('Remote dev chains require --allow-remote-dev and --expected-genesis matching the probe.');
  if(!api.tx.contracts?.instantiateWithCode || !api.rpc.contracts?.call)throw Error('This adapter requires the legacy Contracts pallet and contracts_call RPC.');
  await cryptoWaitReady();const keyring=new Keyring({type:'sr25519',ss58Format:42});
  const relay=keyring.addFromUri('//Alice'),guardian=keyring.addFromUri('//Bob'),recipient=keyring.addFromUri('//Charlie');
  const gas=option('gas','500000000000');
  const shape=api.tx.contracts.instantiateWithCode.meta.args.map(x=>x.name.toString());
  if(!shape.includes('endowment')||shape.includes('storage_deposit_limit'))throw Error('Unrecognized runtime call shape. Probe before adapting to a newer runtime.');
  async function send(tx,signer){
   let unsubscribe;let settled=false;
   return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>finish(Error('Transaction did not finalize within 180 seconds')),180000);
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);unsubscribe?.();error?reject(error):resolve(value);};
    tx.signAndSend(signer,({status,events,dispatchError})=>{
     if(status.isInvalid||status.isDropped||status.isUsurped)return finish(Error(`Transaction ${status.type}`));
     if(!status.isFinalized)return;
     if(dispatchError){let why=dispatchError.toString();if(dispatchError.isModule){const m=api.registry.findMetaError(dispatchError.asModule);why=`${m.section}.${m.name}: ${m.docs.join(' ')}`;}return finish(Error(why));}
     finish(null,{txHash:tx.hash.toHex(),blockHash:status.asFinalized.toHex(),events:events.map(({event})=>({section:event.section,method:event.method,data:event.data.toHuman()}))});
    }).then(unsub=>{unsubscribe=unsub;if(settled)unsub();}).catch(e=>finish(e));
   });
  }
  async function call(contract,input,signer=relay){return send(api.tx.contracts.call(contract,0,gas,hex(input)),signer);}
  async function read(contract,input){
   const result=await api.rpc.contracts.call({origin:relay.address,dest:contract,value:0,gasLimit:gas,inputData:hex(input)});
   if(result.result.isErr)throw Error(`Contract dry-run failed: ${result.result.asErr}`);
   const success=result.result.asOk;if((success.flags.toNumber()&1)!==0){const b=success.data.toU8a(true);throw Error(ERRORS[b[0]]||'Contract reverted');}
   return success.data.toU8a(true);
  }
  mkdirSync('deployments',{recursive:true});
  if(command==='deploy'){
   const wasm=readFileSync('artifacts/airlock.wasm');
   const data=configuration({relay:decodeAddress(relay.address),guardian:decodeAddress(guardian.address)});
   const receipt=await send(api.tx.contracts.instantiateWithCode(units('1000').toString(),gas,hex(wasm),hex(data),hex(Buffer.from(createHash('sha256').update(String(Date.now())).digest().subarray(0,8)))),relay);
   const event=receipt.events.find(e=>e.section==='contracts'&&e.method==='Instantiated');
   if(!event)throw Error('No Instantiated event. Inspect finalized transaction before retrying.');
   const contract=Array.isArray(event.data)?event.data[1]:event.data.contract;
   const record={...info,contract,relay:relay.address,guardian:guardian.address,wasmSha256:createHash('sha256').update(wasm).digest('hex'),receipt};
   writeFileSync('deployments/airlock.local.json',JSON.stringify(record,null,2));console.log('Deployed:',contract);console.log('Finalized transaction:',receipt.txHash);
  }else{
   const deployed=JSON.parse(readFileSync('deployments/airlock.local.json','utf8'));if(deployed.genesis!==genesis)throw Error('Deployment genesis does not match connected chain');
   const contract=deployed.contract;const nonce=BigInt(Date.now());const receipts=[];
   receipts.push(await call(contract,submission(nonce,decodeAddress(recipient.address),units('20'))));
   receipts.push(await call(contract,submission(nonce+1n,decodeAddress(recipient.address),units('80'))));
   receipts.push(await call(contract,messageCall(3,messageKey(nonce+1n)),guardian));
   const state=decodeState(Buffer.from(await read(contract,[0])));
   const output={endpoint,genesis,contract,domain:hex(DOMAIN),receipts,state};
   writeFileSync('deployments/demo.local.json',JSON.stringify(output,(_k,v)=>typeof v==='bigint'?v.toString():v,2));
   console.log('Finalized: normal release, quarantine, guardian cancellation.');
  }
 }
}catch(e){clearTimeout(timeout);console.error(e.message);process.exitCode=1;}
finally{clearTimeout(timeout);if(api)await api.disconnect();else await provider.disconnect();}
