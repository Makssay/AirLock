import solc from 'solc';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {ContractFactory,Wallet,JsonRpcProvider,FetchRequest,formatEther,keccak256} from 'ethers';
const path='deployments/source-sepolia.local.json',journal='deployments/source-deploy-submission.local.json';
const request=new FetchRequest('https://ethereum-sepolia-rpc.publicnode.com');request.timeout=20000;
const rpc=new JsonRpcProvider(request,undefined,{batchMaxCount:1});rpc.pollingInterval=2000;
try{
 if(!process.argv.includes('--send-testnet'))throw Error('Explicit testnet flag required');
 if(existsSync(path)){console.log('Sepolia source is already deployed.');}
 else{
  if(existsSync(journal))throw Error('Submission journal exists; recover it before redeploying');
  const env=parseEnv(readFileSync('.env','utf8'));let wallet;try{wallet=new Wallet(env.PRIVATE.trim().startsWith('0x')?env.PRIVATE.trim():'0x'+env.PRIVATE.trim(),rpc);}catch{throw Error('Cannot open local source test key');}delete env.PRIVATE;
  if(await rpc.send('eth_chainId',[])!=='0xaa36a7')throw Error('Wrong source chain');
  const settings={optimizer:{enabled:true,runs:200},evmVersion:'paris',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}};
  const output=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'AirlockOutbox.sol':{content:readFileSync('contracts/evm/AirlockOutbox.sol','utf8')}},settings})));
  if(output.errors?.some(e=>e.severity==='error'))throw Error('Source contract compilation failed');
  const a=output.contracts['AirlockOutbox.sol'].AirlockOutbox;const artifact={compiler:solc.version(),settings,abi:a.abi,bytecode:'0x'+a.evm.bytecode.object,deployedBytecode:'0x'+a.evm.deployedBytecode.object};writeFileSync('artifacts/evm/AirlockOutbox.json',JSON.stringify(artifact,null,2));
  const to='0x3bbb62bf86d40f26a87e70fe56ee073e69198713',recipient='0x75c9fbc682ead1bfc4c33e461c178deecc1f2c1d';
  const factory=new ContractFactory(artifact.abi,artifact.bytecode,wallet),tx=await factory.getDeployTransaction(to,recipient);
  const gas=(await rpc.estimateGas({...tx,from:wallet.address}))*120n/100n,fee=await rpc.getFeeData();
  const price=fee.maxFeePerGas||fee.gasPrice;if(!price||gas*price>10n**16n)throw Error('Source deployment would exceed 0.01 test ETH');
  const fees=fee.maxFeePerGas?{maxFeePerGas:fee.maxFeePerGas,maxPriorityFeePerGas:fee.maxPriorityFeePerGas}:{gasPrice:fee.gasPrice};
  const deploy=await wallet.populateTransaction({...tx,gasLimit:gas,chainId:11155111,...fees});const signed=await wallet.signTransaction(deploy);const hash=keccak256(signed);
  writeFileSync(journal,JSON.stringify({transactionHash:hash,chainId:11155111,status:'signed'},null,2),{flag:'wx'});
  await rpc.broadcastTransaction(signed);const receipt=await rpc.waitForTransaction(hash,2,180000);if(receipt.status!==1)throw Error('Source deployment reverted');
  const config={name:'Ethereum Sepolia',chainId:11155111,rpc:'https://ethereum-sepolia-rpc.publicnode.com',explorer:'https://sepolia.etherscan.io',contract:receipt.contractAddress,owner:wallet.address,recipient,destination:to,confirmations:6,finality:'Six canonical confirmations; not Ethereum finalized checkpoint proof',deploymentHash:hash,deploymentBlock:receipt.blockNumber};
  writeFileSync(path,JSON.stringify(config,null,2));writeFileSync('config/source-sepolia.json',JSON.stringify(config,null,2));
  console.log(JSON.stringify({sourceContract:config.contract,transactionHash:hash,estimatedMaxCostETH:formatEther(gas*price)},null,2));
 }
}catch(e){console.error(e.shortMessage||e.message);process.exitCode=1;}finally{rpc.destroy();}
