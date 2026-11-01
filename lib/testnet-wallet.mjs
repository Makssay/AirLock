import {parseEther} from 'ethers';
import {lane,sameAddress,verifyOutbox,outboxInterface,readDestination,rpcClient,vaultInterface} from './testnet-lane.mjs';

export async function connectSourceWallet(provider=globalThis.ethereum){
 if(!provider?.request)throw Error('Open this page in a browser with an EVM wallet extension');
 const accounts=await provider.request({method:'eth_requestAccounts'});
 if(!accounts?.length)throw Error('No EVM wallet account was selected');
 return {provider,address:accounts[0]};
}
export async function signSourceRequest(provider,amount,{onSigning=()=>{},onHash=()=>{},read=readDestination,verify=verifyOutbox,quote=quoteRelay}={}){
 if(!['0.25','2','4'].includes(amount))throw Error('Choose a supported testnet payout');
 const rpc=(method,params=[])=>provider.request({method,params});
 if(Number(BigInt(await rpc('eth_chainId')))!==lane.sourceChainId)throw Error('Switch your EVM wallet to Ethereum Sepolia');
 const accounts=await rpc('eth_accounts');
 if(!sameAddress(accounts?.[0],lane.sourceOwner))throw Error('Select the configured Sepolia outbox owner in your wallet');
 await Promise.all([verify(rpc),verify()]);
 const destination=await read();
 if(destination.paused)throw Error('The V3 treasury is paused. Resume it before creating a source request');
 if(destination.pendingPolicy)throw Error('Complete the pending treasury policy change first');
 if(parseEther(destination.balance)<parseEther(destination.reserveFloor)+parseEther(destination.reserved)+parseEther(amount))throw Error('The treasury has insufficient unreserved test funds');
 await quote(amount);
 const input={from:accounts[0],to:lane.sourceContract,value:'0x0',data:outboxInterface.encodeFunctionData('requestRelease',[parseEther(amount)])};
 const [gas,price,balance]=await Promise.all([rpc('eth_estimateGas',[input]),rpc('eth_gasPrice'),rpc('eth_getBalance',[accounts[0],'pending'])]);
 const gasLimit=BigInt(gas)*120n/100n,gasPrice=BigInt(price)*120n/100n;
 if(gasPrice<=0n||gasLimit*gasPrice>10n**15n)throw Error('Sepolia gas exceeds the 0.001 test ETH limit');
 if(BigInt(balance)<gasLimit*gasPrice)throw Error('The selected wallet needs Sepolia test ETH for gas');
 if(!sameAddress((await rpc('eth_accounts'))?.[0],accounts[0])||Number(BigInt(await rpc('eth_chainId')))!==lane.sourceChainId)throw Error('Your wallet account or network changed. Review the request again');
 onSigning({amount,account:accounts[0],createdAt:new Date().toISOString()});
 let hash;
 try{hash=await rpc('eth_sendTransaction',[{...input,gas:'0x'+gasLimit.toString(16),gasPrice:'0x'+gasPrice.toString(16)}]);}
 catch(error){throw Object.assign(Error(error.code===4001?'Wallet signature declined':'Wallet outcome is unknown. Check the wallet activity and recover the transaction hash before trying again.'),{uncertain:error.code!==4001});}
 if(!/^0x[a-f0-9]{64}$/i.test(hash||''))throw Object.assign(Error('Wallet returned no valid hash. Inspect its activity before retrying'),{uncertain:true});
 onHash(hash);return hash;
}
export async function quoteRelay(amount){
 const source=rpcClient(lane.sourceRpc),rpc=rpcClient(lane.destinationRpc);
 const encoded=await source('eth_call',[{to:lane.sourceContract,data:outboxInterface.encodeFunctionData('nonce')},'latest']);
 const nonce=BigInt(outboxInterface.decodeFunctionResult('nonce',encoded)[0])+1n;
 if(nonce>0xffffffffn)throw Error('The source nonce exceeds this configured lane');
 const data=vaultInterface.encodeFunctionData('submit',[lane.domain,(BigInt(lane.sourceChainId)<<32n)|nonce,lane.guardian,parseEther(amount)]);
 const [gas,price,balance]=await Promise.all([rpc('eth_estimateGas',[{from:lane.relay,to:lane.destination,data}]),rpc('eth_gasPrice'),rpc('eth_getBalance',[lane.relay,'pending'])]);
 const cost=BigInt(gas)*110n/100n*BigInt(price);
 if(cost>parseEther('5')||cost+parseEther('0.1')>BigInt(balance))throw Error('Fund the dedicated V3 relay before creating a source request; its estimated transaction cost is not covered');
}
