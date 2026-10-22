# V3 live deployment — 22 October 2026

Airlock is deployed at `0x3bbb62bf86d40f26a87e70fe56ee073e69198713` on verified chain 420420777, genesis `0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd`. Deployment transaction `0x23d1230a3897b65591474b2dadadf7fecc12e6ec34f373474f9c26535bb06e54`, finalized block 146537. The canonical block, exact guardian-signed batch, successful instantiation and complete runtime bytecode were independently checked. V3's code API wraps runtime code in an additional SCALE Vec length; verification accepts it only with an exact length and byte match.

Four live contract-operation transactions and eight checks are recorded in `artifacts/v3-live-evidence.json`. The normal payout returned 1 tPOT to the guardian; a 4 tPOT request was quarantined, then cancelled after the guardian paused releases. Final recorded reserve 49 tPOT, reserved 0, paused true. Replay, oversized drain, early execution and paused release checks are read-only reverts, not mined failed transactions. Split attack, reentrancy, policy changes and resume remain local test coverage.

The user authorized signing from a locally supplied test seed. It was matched to the expected guardian and never printed or committed. Scripts require an explicit testnet flag and reject another genesis/chain/address. Initial storage deposit about 400.263 tPOT is separate from the 50 tPOT contract funding. The local relay received 10 tPOT in the deployment batch and a further 25 tPOT for the reduced live smoke run. Constructor simulation alone had not exposed the high fee estimate for subsequent writes; a 2 tPOT guard prevented the initial smoke attempt from sending any transaction.

The implementation still trusts relay attestations. External source-chain verification and organizer eligibility of this design remain unresolved. This is testnet evidence, not a production security audit.

## Earlier investigation (historical)

# V3 integration status

## Live V3 verification — 21 October 2026

The user supplied https://pindex.onrender.com/. Its explorer footer and linked repository https://github.com/youthisguy/portalIndex expose replacement endpoints:

- Substrate: `wss://test-node-v3.portaldot.dev`
- EVM: `https://test-evm-rpc-v3.portaldot.dev`
- Console link: `https://node-console.portaldot.dev/` (not independently checked)

Read-only RPC confirmed chain `PortaldotV3 Test`, runtime `portaldot-v3` spec 3002, genesis `0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd`, SS58 42 and native symbol `tPOT` with 14 decimals. The Ethereum gateway returned chain ID 420420777 and a live block number. It answered requests with an explicit application User-Agent; the default Python User-Agent received HTTP 403.

At finalized block 131195 the user-supplied SS58 account had 500 tPOT free, no reserved or frozen balance, and nonce 0. `reviveApi.address` returned its H160 address and `reviveApi.accountId` mapped it back to the original account. No transaction was submitted. The account-specific observation is in local research evidence, not in the reusable network config.

Both Contracts and Revive calls are present. This confirms network access, not compatibility of the current Airlock artifacts or a successful deployment. Subsequent verification confirmed `allowEVMBytecode=true`, `nativeToEthRatio=10000`, and a successful native Revive constructor dry-run for the optimized Airlock artifact. The deployment page prepares an atomic relay-funding and deployment transaction for the guardian to sign. No V3 transaction has been sent yet. See `artifacts/v3-preflight.json` and the README deployment section.

## Previously supplied network configuration

The user subsequently provided Discord network details: Substrate `wss://testnetv3-node.feso-apps.xyz`, EVM `https://testnetv3-eth-rpc.feso-apps.xyz`, chain ID 420420777, tPOTv3 with 14 decimals and explorer `https://node-console.feso-apps.xyz/`. These settings are retained as previous endpoints in `config/portaldot-v3.json`; the active entries now use the verified replacement endpoints.

Direct connection attempts on 16 October 2026 failed at name resolution. Independent Google and Cloudflare DNS queries returned status 3 (NXDOMAIN) for all three exact hostnames. The parent domain's SOA was returned, but no endpoint address. This is a snapshot of DNS availability, not a conclusion that the configuration never worked. RPC identity, genesis, runtime and compiler backend therefore remain unverified. Raw observations are in `research/v3-network-probe.json` and `research/v3-dns-check.json`.

## Earlier support correspondence

The user supplied support correspondence on 16 October 2026. It says V3 endpoint, chain ID, supported namespaces, CORS, transports and local source/binary compatibility are unverified. This is correspondence supplied by the user, not independently authenticated documentation. No transcript is published here.

Therefore a legacy spec1002 deployment is not evidence of V3 compatibility. The current Rust seal0 artifact remains an explicitly labelled legacy reference and WASM lab. The new Solidity implementation preserves the security mechanisms with standard native-currency calls and a reentrancy guard, but does not claim successful Portaldot V3 execution.

Revive can involve PolkaVM/RISC-V and resolc. Standard solc EVM bytecode must not be assumed to work on every pallet-revive deployment. Current upstream documentation also describes EVM execution through REVM, but Portaldot's selected configuration is unknown. We need its exact runtime, compiler and Ethereum gateway details before choosing the artifact.

Upstream references:

- https://github.com/paritytech/revive
- https://docs.polkadot.com/smart-contracts/for-eth-devs/evm-vs-pvm/
- https://docs.polkadot.com/develop/parachains/customize-parachain/add-smart-contract-functionality/

## Working verification

- Native Anvil development chain on Windows, bound to 127.0.0.1:8545, chain ID 31337.
- Solidity 0.8.30 compiled for EVM Paris. No opcode requirement for Cancun/PUSH0 is introduced by that target.
- Ten on-chain scenario tests, including native transfer rejection and callback reentrancy.
- End-to-end demo saves real local transaction hashes, block hashes and receipts, with portaldotDeployment=false and reviveCompatibility=unverified.
- Local EVM amounts use 18 decimals. The legacy WASM lab uses 14 decimals from the inspected Portaldot runtime. The Solidity contract operates on base units and needs target-network configuration before deployment elsewhere.
- The EVM demonstration is separate from the WASM lab. The Evidence page labels both sources explicitly.

## Environment blocker

Attempting Ubuntu installation through WSL failed with HCS_E_HYPERV_NOT_INSTALLED: the required Windows virtualization component is unavailable. No reboot was performed and no Windows features were manually enabled. Anvil supplies the local EVM chain without WSL. A downloaded Ubuntu distribution package may remain in Windows' WSL download cache after the failed registration.

## Next Portaldot gate

Network identity is now verified and the supplied account is funded. The compiler path and constructor dry-run are verified. Obtain the guardian wallet signature and verify a finalized deployment before claiming live execution. Eligibility of the custom trusted relay still requires organizer confirmation. Signing requires the wallet owner; a public address alone cannot authorize transactions. Do not use mainnet funds or substitute another network's receipts for Portaldot evidence.
