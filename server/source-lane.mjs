import {readFileSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {Contract,JsonRpcProvider,FetchRequest,Wallet,parseEther,keccak256} from 'ethers';

export const sourceConfig=()=>existsSync('config/source-sepolia.json')?JSON.parse(readFileSync('config/source-sepolia.json','utf8')):null;
export async function createSourceRequest(job,save){
 const config=sourceConfig();if(!config||config.chainId!==11155111)throw Error('Contract: Sepolia source is not configured');
 const request=new FetchRequest(config.rpc);request.timeout=20000;
 const rpc=new JsonRpcProvider(request,undefined,{batchMaxCount:1});rpc.pollingInterval=2000;
 try{
  if(await rpc.send('eth_chainId',[])!=='0xaa36a7')throw Error('Contract: wrong source chain');
  let wallet;try{const env=parseEnv(readFileSync('.env','utf8'));wallet=new Wallet(env.PRIVATE.trim().startsWith('0x')?env.PRIVATE.trim():'0x'+env.PRIVATE.trim(),rpc);delete env.PRIVATE;}catch{throw Error('Contract: source signing key unavailable');}
  if(wallet.address.toLowerCase()!==config.owner.toLowerCase())throw Error('Contract: wrong source owner');
  const artifact=JSON.parse(readFileSync('artifacts/evm/AirlockOutbox.json','utf8'));
  const contract=new Contract(config.contract,artifact.abi,wallet);
  if((await contract.destination()).toLowerCase()!==config.destination.toLowerCase()||(await contract.recipient()).toLowerCase()!==config.recipient.toLowerCase()||(await contract.owner()).toLowerCase()!==config.owner.toLowerCase())throw Error('Contract: source configuration mismatch');
  if(config.runtimeCodeHash&&keccak256(await rpc.getCode(config.contract))!==config.runtimeCodeHash)throw Error('Contract: source code changed');
  const amount=parseEther(job.input.amount);const data=contract.interface.encodeFunctionData('requestRelease',[amount]);
  const gas=(await rpc.estimateGas({to:config.contract,from:wallet.address,data}))*120n/100n,fee=await rpc.getFeeData(),price=fee.maxFeePerGas||fee.gasPrice;
  if(!price||gas*price>10n**15n)throw Error('Limit: source transaction exceeds 0.001 test ETH');
  if(await rpc.getBalance(wallet.address)<gas*price)throw Error('Limit: source wallet has insufficient Sepolia ETH');
  const fees=fee.maxFeePerGas?{maxFeePerGas:fee.maxFeePerGas,maxPriorityFeePerGas:fee.maxPriorityFeePerGas}:{gasPrice:fee.gasPrice};
  const tx=await wallet.populateTransaction({to:config.contract,data,gasLimit:gas,chainId:11155111,...fees});const signed=await wallet.signTransaction(tx);const hash=keccak256(signed);
  job.source={chainId:11155111,contract:config.contract,transactionHash:hash,status:'signed',requiredConfirmations:6};job.status='signed';job.kind='source';save();
  await rpc.broadcastTransaction(signed);job.source.status='waiting for six confirmations';job.status='submitted';save();
  const receipt=await rpc.waitForTransaction(hash,6,240000);if(!receipt||receipt.status!==1)throw Error('Contract: source receipt failed or is not confirmed yet');
  const block=await rpc.getBlock(receipt.blockNumber);if(block.hash!==receipt.blockHash)throw Error('Contract: source block is not canonical');
  if(receipt.to.toLowerCase()!==config.contract.toLowerCase()||receipt.from.toLowerCase()!==config.owner.toLowerCase())throw Error('Contract: unexpected source transaction');
  const events=receipt.logs.filter(l=>l.address.toLowerCase()===config.contract.toLowerCase()).map(l=>{try{return contract.interface.parseLog(l);}catch{return null;}}).filter(e=>e?.name==='ReleaseRequested');
  if(events.length!==1)throw Error('Contract: source event is missing or ambiguous');
  const event=events[0];if(event.args.amount!==amount||event.args.recipient.toLowerCase()!==config.recipient.toLowerCase()||event.args.destination.toLowerCase()!==config.destination.toLowerCase()||event.args.destinationChainId!==420420777n)throw Error('Contract: source event does not match the intended payout');
  if(event.args.nonce<=0n||event.args.nonce>0xffffffffn)throw Error('Contract: source nonce outside the configured lane range');
  const nonce=(11155111n<<32n)|event.args.nonce;
  Object.assign(job.source,{status:'six confirmations verified',blockNumber:receipt.blockNumber,blockHash:receipt.blockHash,eventNonce:event.args.nonce.toString(),destinationNonce:nonce.toString(),amount:job.input.amount,recipient:config.recipient});save();
  return nonce;
 }finally{rpc.destroy();}
}
