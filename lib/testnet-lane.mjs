import {Interface,keccak256,id,formatEther,parseEther} from 'ethers';
import {network} from './public-network.mjs';

export const lane=Object.freeze({
 sourceChainId:11155111,sourceRpc:'https://ethereum-sepolia-rpc.publicnode.com',
 sourceContract:'0x92eB46a2a0F8644Ec13fFbD2d7Cb61762c3A95fE',
 sourceOwner:'0xf337687dD73c1A13EFE39393a000f55a95B1ac54',
 sourceCodeHash:'0xc560bf4795c877637bedd1d92cb004676d73aac58cecc945cdd002611af555da',
 destination:network.contract,destinationChainId:420420777,destinationRpc:network.rpc,
 nativeRpc:'https://test-node-v3.portaldot.dev',nativeWs:'wss://test-node-v3.portaldot.dev',
 genesis:'0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd',
 guardian:'0x75C9FBc682eAD1bFC4C33e461c178dEECC1f2C1D',
 guardianNative:'5HKTe2e7hXWUN6gfreN9dMGQ3TBjqeVbkMzFAFpCaxfvXnQZ',
 relay:'0x74b438f9dDd5E9A35bd6eFD3D032F9411094dD0A',
 domain:id('airlock:external-testnet:v1'),confirmations:6
});
export const vaultInterface=new Interface([
 'function guardian() view returns(address)','function relay() view returns(address)',
 'function sourceDomain() view returns(bytes32)','function paused() view returns(bool)',
 'function policy() view returns(uint128 instant,uint128 cap,uint64 delaySeconds,uint128 maxPending)',
 'function pendingPolicy() view returns(tuple(uint128 instant,uint128 cap,uint64 delaySeconds,uint128 maxPending) policy,uint64 eligibleAt,bool resume,bool exists)',
 'function reserved() view returns(uint256)','function reserveFloor() view returns(uint128)',
 'function spentThisWindow() view returns(uint256)','function windowSeconds() view returns(uint64)',
 'function policyDelaySeconds() view returns(uint64)',
 'function messages(bytes32) view returns(uint8 status,address recipient,uint128 amount,uint64 eligibleAt)',
 'function submit(bytes32,uint64,address,uint128)','function pause()','function cancel(bytes32)',
 'function execute(bytes32)','function schedulePolicy(tuple(uint128 instant,uint128 cap,uint64 delaySeconds,uint128 maxPending),bool)',
 'function activatePolicy()','function cancelPolicy()',
 'event Queued(bytes32 indexed id,address indexed recipient,uint256 amount,uint64 eligibleAt)',
 'event Released(bytes32 indexed id,address indexed recipient,uint256 amount)',
 'event Cancelled(bytes32 indexed id,uint256 amount)'
]);
export const outboxInterface=new Interface([
 'function owner() view returns(address)','function recipient() view returns(address)',
 'function destination() view returns(address)','function nonce() view returns(uint64)','function requestRelease(uint128)',
 'event ReleaseRequested(uint64 indexed nonce,address indexed recipient,uint128 amount,uint256 destinationChainId,address destination)'
]);
export const sameAddress=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
export const validHash=hash=>typeof hash==='string'&&/^0x[a-f0-9]{64}$/i.test(hash);
export function rpcClient(url,{fetchImpl=fetch,signal}={}){
 return async(method,params=[])=>{
  const response=await fetchImpl(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:signal||AbortSignal.timeout(14000)});
  if(!response.ok)throw Error('Testnet connection unavailable');
  const body=await response.json();if(body.error)throw Error('Testnet RPC rejected the request');
  if(!Object.hasOwn(body,'result'))throw Error('Invalid testnet RPC response');return body.result;
 };
}
async function call(rpc,contract,iface,method,args=[],block='latest'){
 return iface.decodeFunctionResult(method,await rpc('eth_call',[{to:contract,data:iface.encodeFunctionData(method,args)},block]));
}
async function sha256(hex){
 if(!/^0x(?:[a-f0-9]{2})+$/i.test(hex||''))throw Error('Deployed contract is unavailable');
 const bytes=Uint8Array.from(hex.slice(2).match(/../g),v=>parseInt(v,16));
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
}
export async function readDestination({rpc=rpcClient(lane.destinationRpc),native=rpcClient(lane.nativeRpc)}={}){
 const [chain,genesis,head]=await Promise.all([rpc('eth_chainId'),native('chain_getBlockHash',[0]),native('chain_getFinalizedHead')]);
 if(Number(BigInt(chain))!==lane.destinationChainId||genesis!==lane.genesis)throw Error('Portaldot network identity mismatch');
 const header=await native('chain_getHeader',[head]);const tag=header.number;
 const [code,block,balance,guardianBalance,relayBalance,...values]=await Promise.all([
  rpc('eth_getCode',[lane.destination,tag]),rpc('eth_getBlockByNumber',[tag,false]),
  rpc('eth_getBalance',[lane.destination,tag]),rpc('eth_getBalance',[lane.guardian,tag]),rpc('eth_getBalance',[lane.relay,tag]),
  ...['guardian','relay','sourceDomain','paused','policy','pendingPolicy','reserved','reserveFloor','spentThisWindow','windowSeconds','policyDelaySeconds'].map(m=>call(rpc,lane.destination,vaultInterface,m,[],tag))
 ]);
 if(!block||BigInt(block.number)!==BigInt(tag)||await sha256(code)!==network.runtimeSha256)throw Error('Portaldot contract code could not be verified');
 const [guardian,relay,domain,paused,policy,pending,reserved,floor,spent,window,policyDelay]=values;
 if(!sameAddress(guardian[0],lane.guardian)||!sameAddress(relay[0],lane.relay)||domain[0]!==lane.domain)throw Error('Portaldot contract roles changed');
 const policyView=p=>({instant:formatEther(p[0]),cap:formatEther(p[1]),delaySeconds:Number(p[2]),maxPending:formatEther(p[3])});
 return {chainId:lane.destinationChainId,contract:lane.destination,finalizedBlock:Number(BigInt(tag)),nativeFinalizedHash:head,
  now:Number(BigInt(block.timestamp))*1000,checkedAt:new Date().toISOString(),paused:paused[0],policy:policyView(policy),
  pendingPolicy:pending[3]?{policy:policyView(pending[0]),eligibleAt:Number(pending[1])*1000,resume:pending[2]}:null,
  balance:formatEther(balance),guardianBalance:formatEther(guardianBalance),relayBalance:formatEther(relayBalance),
  reserved:formatEther(reserved[0]),reserveFloor:formatEther(floor[0]),spent:formatEther(spent[0]),windowSeconds:Number(window[0]),policyDelaySeconds:Number(policyDelay[0]),codeVerified:true};
}
export async function verifyOutbox(rpc=rpcClient(lane.sourceRpc)){
 const [chain,code,owner,recipient,destination]=await Promise.all([
  rpc('eth_chainId'),rpc('eth_getCode',[lane.sourceContract,'latest']),
  ...['owner','recipient','destination'].map(m=>call(rpc,lane.sourceContract,outboxInterface,m))
 ]);
 if(Number(BigInt(chain))!==lane.sourceChainId||keccak256(code)!==lane.sourceCodeHash||!sameAddress(owner[0],lane.sourceOwner)||!sameAddress(recipient[0],lane.guardian)||!sameAddress(destination[0],lane.destination))throw Error('Sepolia outbox verification failed');
 return {chainId:lane.sourceChainId,contract:lane.sourceContract,owner:lane.sourceOwner,codeVerified:true};
}
export function validateSourceEvent(receipt,hash){
 const rejected=message=>Object.assign(Error(message),{sourceRejected:true});
 if(!validHash(hash)||!sameAddress(receipt.transactionHash||receipt.hash,hash)||!sameAddress(receipt.to,lane.sourceContract)||!sameAddress(receipt.from,lane.sourceOwner))throw rejected('Unexpected source transaction');
 if(BigInt(receipt.status)!==1n)throw rejected('Sepolia transaction reverted');
 const events=(receipt.logs||[]).filter(log=>sameAddress(log.address,lane.sourceContract)).map(log=>{try{return outboxInterface.parseLog(log);}catch{return null;}}).filter(e=>e?.name==='ReleaseRequested');
 if(events.length!==1)throw rejected('Missing or ambiguous source event');
 const {nonce,recipient,amount,destinationChainId,destination}=events[0].args;
 if(nonce<=0n||nonce>0xffffffffn||amount<=0n||amount>5n*10n**18n||!sameAddress(recipient,lane.guardian)||destinationChainId!==BigInt(lane.destinationChainId)||!sameAddress(destination,lane.destination))throw rejected('Source event does not match the configured lane');
 const destinationNonce=(BigInt(lane.sourceChainId)<<32n)|nonce;
 // messageId is keccak256(abi.encode(bytes32,uint64)).
 const key=keccak256('0x'+lane.domain.slice(2)+destinationNonce.toString(16).padStart(64,'0'));
 return {transactionHash:hash,sourceNonce:nonce.toString(),destinationNonce:destinationNonce.toString(),key,recipient,amount:formatEther(amount)};
}
export async function inspectSource(hash,{rpc=rpcClient(lane.sourceRpc),destinationRpc=rpcClient(lane.destinationRpc),destination,fromBlock}={}){
 if(!validHash(hash))throw Error('Enter a Sepolia transaction hash');
 await verifyOutbox(rpc);
 const receipt=await rpc('eth_getTransactionReceipt',[hash]);
 if(!receipt)return {transactionHash:hash,state:'waiting',confirmations:0,reason:'Waiting for the source receipt. Keep this transaction; do not create a replacement.'};
 const [tip,block]=await Promise.all([rpc('eth_blockNumber'),rpc('eth_getBlockByNumber',[receipt.blockNumber,false])]);
 if(!block||block.hash!==receipt.blockHash)throw Error('Source block is no longer canonical. Do not relay this request.');
 const confirmations=Math.max(0,Number(BigInt(tip)-BigInt(receipt.blockNumber)+1n));
 if(confirmations<lane.confirmations)return {transactionHash:hash,state:'confirming',confirmations,sourceBlock:Number(BigInt(receipt.blockNumber))};
 const event=validateSourceEvent(receipt,hash);
 const s=destination||await readDestination({rpc:destinationRpc});
 const m=await call(destinationRpc,lane.destination,vaultInterface,'messages',[event.key],'0x'+s.finalizedBlock.toString(16));
 const message=Number(m[0])?{status:['missing','queued','released','cancelled'][Number(m[0])],recipient:m[1],amount:formatEther(m[2]),eligibleAt:Number(m[3])*1000}:null;
 if(message&&(!sameAddress(message.recipient,event.recipient)||message.amount!==event.amount))throw Error('Destination message contents differ from the source event');
 const transactions=[];let receiptScan=null;
 if(message&&Number.isSafeInteger(fromBlock)&&fromBlock>=146537&&fromBlock<=s.finalizedBlock){
  const end=Math.min(s.finalizedBlock,fromBlock+1999);
  try{
   for(let start=fromBlock;start<=end;start+=500){
    const logs=await destinationRpc('eth_getLogs',[{address:lane.destination,fromBlock:'0x'+start.toString(16),toBlock:'0x'+Math.min(start+499,end).toString(16),topics:[[...['Queued','Released','Cancelled'].map(name=>vaultInterface.getEvent(name).topicHash)],event.key]}]);
    for(const log of logs){const parsed=vaultInterface.parseLog(log);if(parsed?.args.id===event.key&&sameAddress(log.address,lane.destination)&&validHash(log.transactionHash))transactions.push({event:parsed.name,hash:log.transactionHash,block:Number(BigInt(log.blockNumber))});}
   }
   receiptScan=end<s.finalizedBlock?'partial':'complete';
  }catch{receiptScan='unavailable';}
 }
 return {...event,confirmations,sourceBlock:Number(BigInt(receipt.blockNumber)),sourceBlockHash:receipt.blockHash,state:message?'accepted':s.paused?'paused':'ready',message,transactions,receiptScan};
}

export function guardianActionData(action,{key,policy}={}){
 if(['cancel','execute'].includes(action)){if(!validHash(key))throw Error('Invalid payout ID');return vaultInterface.encodeFunctionData(action,[key]);}
 if(action==='resume'){
  if(!policy)throw Error('Refresh the current policy before scheduling resume');
  return vaultInterface.encodeFunctionData('schedulePolicy',[[parseEther(policy.instant),parseEther(policy.cap),policy.delaySeconds,parseEther(policy.maxPending)],true]);
 }
 if(['pause','activatePolicy','cancelPolicy'].includes(action))return vaultInterface.encodeFunctionData(action);
 throw Error('Unsupported testnet guardian action');
}

export async function inspectSourceStatus(hash,options){
 try{return await inspectSource(hash,options);}catch(error){if(error.sourceRejected)return {transactionHash:hash,state:'rejected',reason:error.message,confirmations:0};throw error;}
}
