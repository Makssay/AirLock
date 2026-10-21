import { ApiPromise, WsProvider } from '@polkadot/api';
import { Wallet, ContractFactory, id } from 'ethers';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Preparation only: never signs or broadcasts a transaction.
export async function prepareV3() {
const config = JSON.parse(readFileSync('config/portaldot-v3.json', 'utf8'));
const guardian = '5HKTe2e7hXWUN6gfreN9dMGQ3TBjqeVbkMzFAFpCaxfvXnQZ';
mkdirSync('deployments', { recursive: true });
const walletPath = 'deployments/relay-wallet.local.json';
if (!existsSync(walletPath)) {
 const wallet = Wallet.createRandom();
 writeFileSync(walletPath, JSON.stringify({ purpose: 'Airlock Portaldot V3 TESTNET ONLY relay', address: wallet.address, privateKey: wallet.privateKey }, null, 2), { mode: 0o600, flag: 'wx' });
}
const relay = JSON.parse(readFileSync(walletPath, 'utf8')).address;
const provider = new WsProvider(config.substrateRpc, false);
let api;
try {
 const connect = async () => { await provider.connect(); return ApiPromise.create({ provider, throwOnConnect: true }); };
 let timer;
 try { api = await Promise.race([connect(), new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('V3 connection timed out')),30000);})]); } finally { clearTimeout(timer); }
 if (api.genesisHash.toHex() !== config.verification.genesisHash || api.consts.revive.chainId.toString() !== String(config.chainId)) throw Error('Unexpected network identity');
 if (!api.consts.revive.allowEVMBytecode.isTrue) throw Error('This runtime does not allow EVM bytecode');
 const guardianEvm = (await api.call.reviveApi.address(guardian)).toString();
 const relayNative = (await api.call.reviveApi.accountId(relay)).toString();
 const artifact = JSON.parse(readFileSync('artifacts/evm/Airlock.json', 'utf8'));
 const U = 10n ** 18n, N = 10n ** 14n;
 const args = [relay, guardianEvm, id('airlock:external-testnet:v1'), [U, 5n*U, 120, 20n*U], 600, 300, 5n*U];
 const creation = await new ContractFactory(artifact.abi, artifact.bytecode).getDeployTransaction(...args);
 // Revive requires EVM constructor arguments appended to initcode; data must be empty.
 const data = '0x';
 const value = 50n*N;
 const dry = await api.call.reviveApi.instantiate(guardian, value.toString(), null, null, { Upload: creation.data }, data, null);
 const report = { checkedAt: new Date().toISOString(), network: config, guardian, guardianEvm, relay, relayNative, nativeDecimals: 14, evmDecimals: 18, nativeToEthRatio: api.consts.revive.nativeToEthRatio.toString(), vaultTokens: '50', relayFundingTokens: '10', policy: { instant: '1', cap: '5', maxPending: '20', reserveFloor: '5', windowSeconds: 600, delaySeconds: 120, policyDelaySeconds: 300 }, constructorData: data, dryRun: dry.toJSON(), broadcast: false };
 report.creationCode = creation.data;
 if (dry.result.isErr && dry.result.asErr.isModule) { const e=api.registry.findMetaError(dry.result.asErr.asModule); report.error=`${e.section}.${e.name}: ${e.docs.join(' ')}`; }
 if (dry.result.isErr) throw Error('Contract creation dry-run failed; inspect preparation report');
 if ((Number(report.dryRun.result.ok.result.flags.bits) & 1) !== 0) throw Error('Constructor reverted');
 const weight = {refTime:(BigInt(dry.weightRequired.refTime.toString())*125n/100n).toString(),proofSize:(BigInt(dry.weightRequired.proofSize.toString())*125n/100n).toString()};
 const deposit = BigInt(dry.storageDeposit.asCharge.toString());
 const depositLimit = ((deposit*102n/100n + N-1n)/N)*N;
 const deploy = api.tx.revive.instantiateWithCode(value.toString(),weight,depositLimit.toString(),creation.data,'0x',null);
 const funding = api.tx.balances.transferKeepAlive(relayNative,(10n*N).toString());
 const batch = api.tx.utility.batchAll([funding,deploy]);
 const fee = await batch.paymentInfo(guardian);
 const account = await api.query.system.account(guardian);
 const available = BigInt(account.data.free.toString()) - BigInt(account.data.frozen.toString());
 const budget = value + 10n*N + depositLimit + BigInt(fee.partialFee.toString())*2n + BigInt(api.consts.balances.existentialDeposit.toString());
 if (budget > available) throw Error('Insufficient balance for deployment, storage cap, relay funding and fee margin');
 Object.assign(report,{storageDepositBaseUnits:deposit.toString(),storageDepositLimitBaseUnits:depositLimit.toString(),estimatedFeeBaseUnits:fee.partialFee.toString(),availableBaseUnits:available.toString(),budgetBaseUnits:budget.toString(),weightLimit:weight,callData:batch.method.toHex(),artifactBytecodeHash:(await import('ethers')).keccak256(artifact.bytecode)});
 writeFileSync('deployments/v3-preparation.local.json', JSON.stringify(report, null, 2));
 return report;
} finally { if (api) await api.disconnect(); else await provider.disconnect(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 try { const r=await prepareV3(); console.log(JSON.stringify({relay:r.relay,guardian:r.guardian,storageDepositBaseUnits:r.storageDepositBaseUnits,estimatedFeeBaseUnits:r.estimatedFeeBaseUnits,budgetBaseUnits:r.budgetBaseUnits,broadcast:false,report:'deployments/v3-preparation.local.json'},null,2)); }
 catch(e){console.error(e.message);process.exitCode=1;}
}
