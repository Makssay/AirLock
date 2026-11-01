import {readFileSync,writeFileSync,existsSync,mkdirSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {Wallet} from 'ethers';
import {TestnetRelay} from '../server/testnet-relay.mjs';
import {lane,rpcClient,outboxInterface} from '../lib/testnet-lane.mjs';
const args=process.argv.slice(2),value=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
if(!args.includes('--send-testnet'))throw Error('Use --send-testnet to arm this dedicated V3 testnet relay');
const walletPath=value('--wallet');if(!walletPath)throw Error('Provide the existing dedicated relay wallet with --wallet; never pass its key as an argument');
mkdirSync('deployments',{recursive:true});
const path=resolve('deployments/testnet-relay.local.json'),lock=resolve('deployments/testnet-relay.local.lock');
let locked=false,stopping=false;
try{
 if(existsSync(lock)){
  const pid=Number(readFileSync(lock,'utf8'));if(!Number.isInteger(pid)||pid<=0)throw Error('Invalid relay lock; inspect it manually');let alive=true;
  try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH')alive=false;else throw Error('Cannot verify relay process lock');}
  if(alive)throw Error('Another testnet relay already owns this journal');unlinkSync(lock);
 }
 writeFileSync(lock,String(process.pid),{flag:'wx'});locked=true;
 const file=JSON.parse(readFileSync(resolve(walletPath),'utf8')),wallet=new Wallet(file.privateKey);delete file.privateKey;
 const rpc=async(method,params=[])=>rpcClient(lane.sourceRpc)(method,params);
 const journal=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{chainId:lane.destinationChainId,contract:lane.destination,jobs:[],cursor:Number(BigInt(await rpc('eth_blockNumber'))),startedAt:new Date().toISOString()};
 const save=state=>writeFileSync(path,JSON.stringify(state,null,2),{flush:true});save(journal);
 const relay=new TestnetRelay({journal,save,wallet});
 if(value('--source-hash'))await relay.register(value('--source-hash'));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;});
 console.log(JSON.stringify({mode:'real-testnets',relay:wallet.address,sourceStartBlock:journal.cursor,journal:path}));
 let previous='';
 do{
  try{
   const tip=Number(BigInt(await rpc('eth_blockNumber')))-lane.confirmations+1;
   if(journal.cursor<tip){
    const end=Math.min(tip,journal.cursor+200);
    const logs=await rpc('eth_getLogs',[{address:lane.sourceContract,fromBlock:'0x'+(journal.cursor+1).toString(16),toBlock:'0x'+end.toString(16),topics:[outboxInterface.getEvent('ReleaseRequested').topicHash]}]);
    for(const hash of new Set(logs.map(log=>log.transactionHash)))await relay.register(hash);
    journal.cursor=end;save(journal);
   }
   const result=await relay.tick(),text=JSON.stringify(result);
   journal.checkedAt=new Date().toISOString();journal.lastStatus=result;save(journal);
   if(text!==previous){console.log(text);previous=text;}
  }catch{console.error('Testnet relay check unavailable; saved hashes retained. No replacement transaction was created.');}
  if(!args.includes('--once')&&!stopping)await new Promise(resolve=>setTimeout(resolve,12000));
 }while(!args.includes('--once')&&!stopping);
}finally{if(locked)unlinkSync(lock);}
