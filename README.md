# Airlock

A withdrawal firewall for Portaldot cross-chain integrations. A compromised relay can request a release; it cannot bypass independently controlled limits, timelocks or guardian cancellation.

**Status:** deployed and verified on Portaldot V3 testnet at `0x3bbb62bf86d40f26a87e70fe56ee073e69198713`, deployment block 146537. A live smoke run finalized normal release, quarantine, guardian pause and cancellation; replay, oversized drain, early execution and paused release were rejected by read-only calls. The recorded end state is 49 tPOT, zero reservations and paused releases. Full split-attack, policy and adversarial-recipient scenarios remain local tests. No external-chain proof or production-readiness claim is made. See [live evidence](artifacts/v3-live-evidence.json).

## Run the prototype

Requirements: Node.js 22+, npm. The compiled WASM artifact is included.

```powershell
npm ci
npm test
npm run dev
```

Open http://127.0.0.1:5173. The service binds only to loopback. Lab state is in memory and resets on restart. The lab controls use simulated funds. The separate Deploy to V3 page connects a Substrate wallet and sends a real testnet deployment only after the user requests and signs it.

To rebuild the contract, install Rust and the official target:

```powershell
rustup target add wasm32v1-none
npm run build:contract
npm test
```

Production frontend:

```powershell
npm run build
npm run preview
```

## Portaldot V3 deployment

```powershell
npm run build:evm
npm run v3:prepare
npm run dev
```

Open http://127.0.0.1:5173/#deploy in the browser containing your Substrate wallet extension. Refresh the simulation, connect the guardian account, review the amounts, and sign. The in-app browser may not have access to your wallet extension.

Preparation creates a separate random TESTNET relay in ignored `deployments/relay-wallet.local.json`. This local file contains its private key; keep it private and never use this disposable wallet on mainnet. No guardian secrets are stored or requested. Public deployment preparation is in `deployments/v3-preparation.local.json`.

The guardian signs one `utility.batchAll`: fund the relay with 10 tPOT and instantiate Airlock with 50 tPOT. The current optimized artifact requires a storage deposit of about 400.263 tPOT, separately from the reserve, with a 409 tPOT cap. The estimated batch network fee was 0.6214 tPOT on 21 October. Preparation re-estimates weight, deposit, fees and available balance. The UI rejects stale preparation, another network, another guardian or changed deployment call. An unsuccessful batch rolls back both calls, although network fees still apply.

Native Substrate amounts use 14 decimals; EVM contract amounts use 18 decimals (verified native-to-Ethereum ratio 10000). EVM initcode must include constructor arguments, with the native instantiate call's `data` empty. Build uses solc 0.8.30, viaIR, optimizer runs 1, Paris. Runtime bytecode is 4865 bytes; the previous 6262-byte build exceeded this account's storage budget.

After finalization the local server independently verifies the canonical block, guardian signer, exact call, success event, instantiation and code presence before saving `deployments/airlock-v3.local.json`. Wallet-observed receipts can also be downloaded. A simulation address is never presented as an already deployed contract. If finalization times out, check the transaction before attempting another deployment.

### Optional local testnet signing

The user may supply the disposable test guardian's mnemonic as `SEED` in local `.env` (ignored by Git). Never paste it into a chat or commit it. Only CLI scripts read it; Express and the frontend do not. The script verifies the exact guardian address, hardcoded testnet genesis and chain ID, and deployment budget before signing. It writes a transaction journal before broadcasting and blocks blind redeployment after an uncertain result.

```powershell
npm run v3:deploy:local -- --send-testnet
npm run v3:smoke -- --send-testnet
```

Do not rerun these commands on an already used deployment. Smoke tests refuse an existing journal by default. The recorded run used an additional 25 tPOT transfer from guardian to the local relay (35 tPOT funded in total). The Ethereum RPC fee estimate for a first contract write was about 19.5 tPOT, so the live scenario was deliberately reduced instead of sending many split requests. The initial 2 tPOT relay transaction guard stopped the first attempt before signing; no duplicate payment occurred. Live evidence contains four contract-operation receipts, plus a separate deployment and relay-top-up receipt in local journals. Static rejection checks do not incur transaction fees and have no transaction hashes.

The signing keypair is locked after use. `.env` remains local for the user's own management. The currently deployed contract is paused. Refreshing the lab only resets the WASM sandbox; it cannot reset or unpause V3.

## Three-minute demo

1. Send the normal 20 POT lab payment. Show release, vault balance and receipt.
2. Run the relay attack. Small withdrawals consume the remaining fixed-window budget; excess small and large admissible messages are quarantined. The 900 POT drain is rejected.
3. Inspect a queued request. Advancing the clock does not bypass the cumulative cap.
4. Pause as guardian, then cancel the queue. The pending reservation becomes available while the vault funds remain.
5. Test replay; the contract rejects reuse of an accepted source nonce.
6. Open Release policy. Schedule resume and show that it cannot activate before the separate policy delay.
7. Download evidence. Its receipts identify the local WASM host and compiled contract SHA-256, not blockchain transaction hashes.

The attacker can steal the configured available instant budget. Airlock limits loss under its stated assumptions; it does not magically prevent all theft. See [threat model](docs/THREAT-MODEL.md).

## Architecture

```text
Lab message composer / relay attack
              |
       fixed-width ABI
              |
    compiled Rust airlock.wasm
              |
     isolated seal0 host
     storage / POT / clock
              |
    receipts + operator interface

Separate deployment adapter
              |
     @polkadot/api + node metadata
              |
    actual legacy Portaldot dev node
```

The interface's source-chain lane is a lab message source. No second blockchain or external-chain proof is implemented yet. The protection logic is in the Rust contract, not a frontend simulation of its decisions.

## Real development-chain adapter

### Solidity / local EVM

This path runs on Windows without WSL. Native Anvil binaries are installed as optional platform dependencies from the official Foundry npm packages. The node binds only to loopback and uses public development keys.

```powershell
npm run build:evm
npm run test:evm
npm run evm:node
```

In a second terminal:

```powershell
npm run evm:demo
```

The demonstration deploys `contracts/evm/Airlock.sol`, executes normal and compromised-relay requests, mines a rejected drain attempt, pauses, and cancels the queue. It saves 15 actual local transaction receipts in `deployments/evm-demo.local.json` and a snapshot in `artifacts/evm/local-chain-evidence.json`. The Evidence page displays this separately from WASM host receipts. These transactions are on chain ID 31337, **not Portaldot**. The EVM reference uses 18-decimal local native units; the legacy WASM lab uses 14-decimal local POT units. Deployment to a PVM backend may require resolc and a different artifact.

### Legacy Portaldot (pending reachable node)

Run the official local client in Linux/WSL with `--dev --alice` and its WebSocket endpoint. The public materials inspected so far describe the legacy runtime, not a verified V3 environment.

```powershell
npm run chain:probe -- --endpoint ws://127.0.0.1:9944
npm run chain:deploy -- --endpoint ws://127.0.0.1:9944
npm run chain:demo -- --endpoint ws://127.0.0.1:9944
```

The adapter refuses Mainnet and non-Development/Local chain types. Dev signing uses public Alice/Bob keys only on these development chains. Deployment endows the contract with 1,000 local POT. Remote development chains additionally require `--allow-remote-dev --expected-genesis <verified hash>`. Probe does not sign or send transactions. Deploy/demo are explicit writes and save finalized receipts under deployments. A new chain/runtime requires compatibility review, not blind retries.

## Current verification

- 27 tests cover compiled WASM and lab session behavior, including an adversarial 250-step sequence.
- 10 additional Solidity scenarios execute as transactions on an isolated native Anvil chain, including failed-payout rollback and reentrancy protection. Node's test runner counts the enclosing suite as one additional test.
- Production frontend builds successfully.
- Compiled artifact passes the vendored portawasm legacy-format validator (8,164 bytes, memory 2–16 pages). This is an offline compatibility check, not proof of on-chain execution.
- WSL Ubuntu registration failed with missing virtualization support. No reboot was performed. Portaldot deployment remains pending a reachable accepted node; local EVM verification runs independently through native Anvil.

## Files

- `contracts/airlock/src/lib.rs`: contract and authorization/state transitions.
- `lib/wasm-lab.mjs`: isolated execution host.
- `lib/abi.mjs`: encoders, decoders and stable error codes.
- `server/session.mjs`: lab scenarios and receipts.
- `scripts/chain.mjs`: probe/deploy/demo adapter.
- `docs/ABI.md`: custom seal0 wire format.
- `research/`: earlier documentation/runtime audit; not competition code evidence.

## Attribution

Original Airlock contract and interface built for this project. Runtime integration researched from the public [Portaldot source](https://github.com/portaldotVolunteer/Portaldot), [developer documentation](https://portaldot-dev.readthedocs.io/en/latest/) and [portaldot-contract-zero](https://github.com/jonathan-moore58/portaldot-contract-zero) (MIT). The latter's `tools/portawasm.py` is vendored unmodified for offline validation; its license is in `tools/PORTAWASM-LICENSE`. No translator or complete pre-existing competition project is submitted as Airlock. Third-party dependencies and versions are recorded in package-lock.json. The custom contract has no Rust dependencies.

## Next acceptance milestones

1. Confirm contest deployment environment and relay model with organizers.
2. Deploy the compiled contract and reproduce normal/quarantine/cancel against that node.
3. Add one real external testnet source and a specified relay verification model.
4. Replace lab-only role switching with wallet authorization in a separate chain mode.
5. Record a reproducible on-chain demo, public repository and pitch deck.
