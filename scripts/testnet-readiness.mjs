import {writeFileSync} from 'node:fs';
import {ApiPromise,WsProvider} from '@polkadot/api';
import {formatEther} from 'ethers';
import {lane,readDestination,verifyOutbox,guardianActionData} from '../lib/testnet-lane.mjs';
import {matchesV3RuntimeHash} from '../lib/v3-code.mjs';
import {network} from '../lib/public-network.mjs';
const [destination,source]=await Promise.all([readDestination(),verifyOutbox()]);
const provider=new WsProvider(lane.nativeWs,false);let api,timer;
try{
 await provider.connect();api=new ApiPromise({provider,throwOnConnect:true});
 await Promise.race([api.isReadyOrError,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Native readiness timed out')),30000);})]);clearTimeout(timer);
 if(api.genesisHash.toHex()!==lane.genesis||Number(api.consts.revive.chainId.toString())!==lane.destinationChainId)throw Error('Native identity mismatch');
 if(!await matchesV3RuntimeHash((await api.call.reviveApi.code(lane.destination)).toU8a(true),network.runtimeSha256))throw Error('Native code mismatch');
 const account=await api.query.system.account(lane.guardianNative),available=BigInt(account.data.free.toString())-BigInt(account.data.frozen.toString());
 const dry=await api.call.reviveApi.call(lane.guardianNative,lane.destination,0,null,null,guardianActionData('resume',{policy:destination.policy}));
 const peak=dry.maxStorageDeposit.isCharge?BigInt(dry.maxStorageDeposit.asCharge.toString()):0n;
 let reason=null;
 if(dry.result.isErr){reason='Runtime rejected the resume simulation';if(dry.result.asErr.isModule){const e=api.registry.findMetaError(dry.result.asErr.asModule);reason=e.section+'.'+e.name;}}
 else if((Number(dry.toJSON().result.ok.flags.bits)&1)!==0)reason='Contract rejected the resume simulation';
 const tokens=base=>formatEther(base*10000n);
 const report={checkedAt:new Date().toISOString(),scope:'Read-only public-testnet readiness, not a new payout or wallet interaction',source,destination,
  guardian:{address:lane.guardianNative,available:tokens(available),resumeSimulation:reason?'blocked':'accepted',reason,peakStorageDeposit:tokens(peak),minimumFundingGapBeforeFees:tokens(peak>available?peak-available:0n)},
  readyToCreateSourceRequest:!destination.paused&&!reason,signingKeysLoaded:false,transactionsBroadcast:false};
 if(process.argv.includes('--write'))writeFileSync('artifacts/live-testnet-readiness.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}finally{clearTimeout(timer);if(api)await api.disconnect();else await provider.disconnect();}
