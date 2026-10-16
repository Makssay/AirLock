# V3 integration status

## Newly supplied network configuration

The user subsequently provided Discord network details: Substrate `wss://testnetv3-node.feso-apps.xyz`, EVM `https://testnetv3-eth-rpc.feso-apps.xyz`, chain ID 420420777, tPOTv3 with 14 decimals and explorer `https://node-console.feso-apps.xyz/`. These declared settings are saved in `config/portaldot-v3.json`.

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

Obtain official V3 RPC, chain ID/genesis, faucet, contract compiler/backend, reproducible deploy example, and a decision on whether the custom trusted relay is eligible. Then deploy a probe before adapting Airlock. Do not use mainnet funds or substitute another network's receipts for Portaldot evidence.
