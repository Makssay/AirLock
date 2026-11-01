import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AbiCoder,keccak256,parseEther} from 'ethers';
import {lane,rpcClient,vaultInterface,outboxInterface,validateSourceEvent,inspectSource,inspectSourceStatus,readDestination,guardianActionData} from '../lib/testnet-lane.mjs';
import {signSourceRequest} from '../lib/testnet-wallet.mjs';
import api from '../api/testnet.mjs';
const hash='0x'+'ab'.repeat(32),blockHash='0x'+'cd'.repeat(32);
const code=readFileSync('artifacts/source-sepolia-runtime.hex','utf8').trim();
function sourceReceipt(args=[1,lane.guardian,parseEther('2'),420420777,lane.destination]){
 const event=outboxInterface.encodeEventLog(outboxInterface.getEvent('ReleaseRequested'),args);
 return {transactionHash:hash,status:'0x1',from:lane.sourceOwner,to:lane.sourceContract,blockNumber:'0x64',blockHash,logs:[{address:lane.sourceContract,...event}]};
}
function sourceRpc({receipt=sourceReceipt(),tip='0x69',canonical=blockHash,sourceCode=code}={}){
 return async(method,params)=>{
  if(method==='eth_chainId')return '0xaa36a7';if(method==='eth_getCode')return sourceCode;
  if(method==='eth_getTransactionReceipt')return receipt;if(method==='eth_blockNumber')return tip;
  if(method==='eth_getBlockByNumber')return {hash:canonical};
  if(method==='eth_call'){const parsed=outboxInterface.parseTransaction({data:params[0].data});return outboxInterface.encodeFunctionResult(parsed.name,[{owner:lane.sourceOwner,recipient:lane.guardian,destination:lane.destination}[parsed.name]]);}
  throw Error('Unexpected source call '+method);
 };
}
const destination={finalizedBlock:200,paused:false,policy:{instant:'1',cap:'5',delaySeconds:120,maxPending:'20'},balance:'48.75',reserved:'0',reserveFloor:'5'};

test('pinned source config and captured deployed runtime agree',()=>{
 const config=JSON.parse(readFileSync('config/source-sepolia.json','utf8'));assert.equal(lane.sourceCodeHash,keccak256(code));
 assert.equal(lane.sourceCodeHash,config.runtimeCodeHash);assert.equal(lane.sourceContract,config.contract);assert.equal(lane.sourceOwner,config.owner);assert.equal(lane.destination,config.destination);
});
test('source nonce maps to the exact existing Solidity message ID',()=>{
 const result=validateSourceEvent(sourceReceipt(),hash),nonce=(11155111n<<32n)|1n;
 assert.equal(BigInt(result.destinationNonce),nonce);
 assert.equal(result.key,keccak256(AbiCoder.defaultAbiCoder().encode(['bytes32','uint64'],[lane.domain,nonce])));
});
test('source verification rejects wrong owners, destinations, nonce range, amounts and duplicate events',()=>{
 const wrong=sourceReceipt();wrong.from=lane.relay;assert.throws(()=>validateSourceEvent(wrong,hash),/Unexpected/);
 for(const args of [[0,lane.guardian,parseEther('2'),420420777,lane.destination],[0x100000000n,lane.guardian,parseEther('2'),420420777,lane.destination],[1,lane.relay,parseEther('2'),420420777,lane.destination],[1,lane.guardian,parseEther('6'),420420777,lane.destination],[1,lane.guardian,parseEther('2'),1,lane.destination]])assert.throws(()=>validateSourceEvent(sourceReceipt(args),hash),/configured lane/);
 const duplicate=sourceReceipt();duplicate.logs.push(duplicate.logs[0]);assert.throws(()=>validateSourceEvent(duplicate,hash),/ambiguous/);
 const reverted=sourceReceipt();reverted.status='0x0';assert.throws(()=>validateSourceEvent(reverted,hash),/reverted/);
});
test('unconfirmed or missing source receipts do not authorize destination relay',async()=>{
 const waiting=await inspectSource(hash,{rpc:sourceRpc({receipt:null}),destinationRpc:()=>{throw Error('Must not observe destination');}});assert.equal(waiting.state,'waiting');
 const confirming=await inspectSource(hash,{rpc:sourceRpc({tip:'0x68'}),destinationRpc:()=>{throw Error('Must not observe destination');}});assert.equal(confirming.state,'confirming');assert.equal(confirming.confirmations,5);
});
test('source reorg and changed outbox code fail closed',async()=>{
 await assert.rejects(inspectSource(hash,{rpc:sourceRpc({canonical:'0x'+'ef'.repeat(32)})}),/canonical/);
 await assert.rejects(inspectSource(hash,{rpc:sourceRpc({sourceCode:'0x1234'})}),/verification/);
});
test('a rejected recovery hash is distinguished from an unavailable network without authorizing relay',async()=>{
 const bad=sourceReceipt();bad.from=lane.relay;
 const result=await inspectSourceStatus(hash,{rpc:sourceRpc({receipt:bad})});assert.equal(result.state,'rejected');assert.equal(result.message,undefined);
 await assert.rejects(inspectSourceStatus(hash,{rpc:sourceRpc({canonical:'0x'+'ee'.repeat(32)})}),/canonical/);
});
test('destination state is read at native finalized height and compared with the exact source payout',async()=>{
 const destinationRpc=async(method,params)=>{assert.equal(method,'eth_call');assert.equal(params[1],'0xc8');return vaultInterface.encodeFunctionResult('messages',[1,lane.guardian,parseEther('2'),999]);};
 const result=await inspectSource(hash,{rpc:sourceRpc(),destinationRpc,destination});assert.equal(result.state,'accepted');assert.equal(result.message.status,'queued');assert.equal(result.message.eligibleAt,999000);
 await assert.rejects(inspectSource(hash,{rpc:sourceRpc(),destination,destinationRpc:async()=>vaultInterface.encodeFunctionResult('messages',[2,lane.relay,parseEther('2'),0])}),/contents differ/);
});
test('Portaldot identity is checked before any contract observation',async()=>{
 await assert.rejects(readDestination({rpc:async()=> '0xaa36a7',native:async method=>method==='chain_getBlockHash'?lane.genesis:blockHash}),/identity/);
});
test('a resume preserves policy amounts in EVM units and arbitrary wallet calldata is refused',()=>{
 const parsed=vaultInterface.parseTransaction({data:guardianActionData('resume',{policy:destination.policy})});
 assert.equal(parsed.args[0][0],parseEther('1'));assert.equal(parsed.args[0][1],parseEther('5'));assert.equal(parsed.args[0][3],parseEther('20'));assert.equal(parsed.args[1],true);
 assert.throws(()=>guardianActionData('transfer'),/Unsupported/);assert.throws(()=>guardianActionData('cancel',{key:'0x12'}),/Invalid/);
});
function walletFixture(overrides={}){
 const sends=[],events=[];
 const provider={request:async({method,params})=>{
  if(overrides[method])return overrides[method](params);
  if(method==='eth_chainId')return '0xaa36a7';if(method==='eth_accounts')return [lane.sourceOwner];
  if(method==='eth_estimateGas')return '0x10000';if(method==='eth_gasPrice')return '0x3b9aca00';if(method==='eth_getBalance')return '0x'+parseEther('1').toString(16);
  if(method==='eth_sendTransaction'){events.push('wallet');sends.push(params[0]);return hash;}
  throw Error('Unexpected wallet call '+method);
 }};
 const options={read:async()=>destination,verify:async()=>{},quote:async()=>{},onSigning:()=>events.push('saved-draft'),onHash:()=>events.push('saved-hash')};return {provider,sends,events,options};
}
test('source wallet signs only the supported owner call and saves its hash without waiting for confirmations',async()=>{
 const f=walletFixture();assert.equal(await signSourceRequest(f.provider,'2',f.options),hash);
 assert.deepEqual(f.events,['saved-draft','wallet','saved-hash']);assert.equal(f.sends.length,1);assert.equal(f.sends[0].to,lane.sourceContract);assert.equal(f.sends[0].value,'0x0');
 assert.equal(outboxInterface.parseTransaction({data:f.sends[0].data}).args[0],parseEther('2'));
});
test('wrong wallet/network, paused vault, missing reserves and expensive source gas never reach signing',async()=>{
 const cases=[walletFixture({eth_chainId:async()=> '0x1'}),walletFixture({eth_accounts:async()=>[lane.relay]}),walletFixture(),walletFixture(),walletFixture({eth_gasPrice:async()=> '0x'+parseEther('1').toString(16)})];
 cases[2].options.read=async()=>({...destination,paused:true});cases[3].options.read=async()=>({...destination,balance:'5'});
 for(const f of cases){await assert.rejects(signSourceRequest(f.provider,'2',f.options));assert.equal(f.sends.length,0);assert.deepEqual(f.events,[]);}
});
test('an account change during preparation stops the source signature',async()=>{
 let calls=0;const f=walletFixture({eth_accounts:async()=>[++calls===1?lane.sourceOwner:lane.relay]});
 await assert.rejects(signSourceRequest(f.provider,'2',f.options),/changed/);assert.equal(f.sends.length,0);
});
test('a failed durable pre-sign journal stops before opening the wallet signature request',async()=>{
 const f=walletFixture();f.options.onSigning=()=>{throw Error('Browser storage unavailable');};
 await assert.rejects(signSourceRequest(f.provider,'2',f.options),/storage/);assert.equal(f.sends.length,0);
});
test('wallet rejection is distinguished from an ambiguous broadcast outcome',async()=>{
 for(const [code,uncertain] of [[4001,false],[-32000,true]]){
  const f=walletFixture({eth_sendTransaction:async()=>{throw Object.assign(Error('fixture'),{code});}});
  await assert.rejects(signSourceRequest(f.provider,'2',f.options),error=>{assert.equal(error.uncertain,uncertain);return true;});assert.deepEqual(f.events,['saved-draft']);
 }
});
test('public testnet endpoint rejects writes, unrelated origins and malformed hashes before any RPC call',async()=>{
 const response=()=>({code:200,setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
 for(const [req,status] of [[{method:'POST',headers:{}},405],[{method:'GET',headers:{origin:'https://evil.example'}},403],[{method:'GET',headers:{},query:{hash:'0x12'}},400]]){const res=response();await api(req,res);assert.equal(res.code,status);}
});
test('each RPC request receives its own deadline instead of expiring a long-running observer client',async()=>{
 const signals=[],rpc=rpcClient('https://fixture.invalid',{fetchImpl:async(_url,opts)=>{signals.push(opts.signal);return {ok:true,json:async()=>({result:'ok'})};}});
 await rpc('eth_chainId');await rpc('eth_chainId');assert.notEqual(signals[0],signals[1]);assert.equal(signals[1].aborted,false);
});

test('live testnet screen exposes operator roles and real tokens separately from the simulation',async()=>{
 const {createServer}=await import('vite'),{createServer:createHttpServer}=await import('node:http'),React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
 const vite=await createServer({server:{middlewareMode:true,hmr:{server:createHttpServer()}},appType:'custom'});
 try{const {default:Page}=await vite.ssrLoadModule('/src/LiveTestnet.jsx');const html=renderToStaticMarkup(React.createElement(Page,{onBack:()=>{}}));assert.match(html,/Live testnets/);assert.match(html,/Shared team test treasury/);assert.match(html,/Connect source wallet/);assert.match(html,/Connect guardian wallet/);assert.match(html,/wallet-free simulation/);assert.doesNotMatch(html,/seed phrase|private key|TELEGRAM_BOT_TOKEN/);}finally{await vite.close();}
});
