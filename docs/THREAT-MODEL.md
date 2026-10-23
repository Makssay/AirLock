# Airlock V3 threat model

Airlock is an independently administered withdrawal firewall around a native POT reserve. It bounds releases initiated by a trusted-message relay that may become compromised. It does not authenticate remote-chain facts and is not a bridge, light client, insurance product or guarantee against all loss.

## Enforced controls

- Only the immutable relay can submit; one immutable source domain is accepted.
- Every accepted source nonce is permanently consumed, including after cancellation.
- Instant threshold is per request; fixed-window cap is cumulative across immediate and queued payouts.
- Amounts larger than the entire window cap are rejected rather than permanently queued.
- Queued payments reserve funds at submission. Immediate payments cannot spend these reservations or the configured native reserve floor.
- Maximum total queued reservation limits the relay's ability to immobilize the vault. The guardian can cancel reservations and pause.
- Mature queued payouts are permissionless, but still require budget and an unpaused vault. Delay expiration is permission to attempt execution, not automatic approval.
- Policy changes and resume require an immutable activation delay. Replacing a proposal restarts that delay. Queued message deadlines do not shorten retroactively.
- Failed transfers revert state, counters and events.

## Explicit limits

- A compromised relay can immediately release the available fixed-window budget. It can continue in subsequent windows if the guardian does not respond. At a boundary, two adjacent window budgets can be released close together. This is not a rolling-window bound.
- A single guardian can censor, pause indefinitely, or eventually weaken the policy. Guardian compromise and relay/guardian collusion are not solved. A multisig guardian is a possible later extension, not implemented here.
- Relay and guardian cannot rotate in this version. Recovery requires a new deployment and an explicit migration design.
- Records grow with unique accepted messages. Tests bound value exposure, not indefinite storage growth or spam fees.
- V3 operations require network fees and storage deposits. The reserve floor does not fund operator wallets automatically. Guardian and relay funding are checked separately before signing; a late or underfunded guardian can miss the quarantine window.
- Solidity native transfers can invoke recipient code. Every mutating entry point has a reentrancy guard; EVM tests cover a recipient attempting a nested queued release and a recipient rejecting payment.
- Fixed source domain labels and nonces do not prove source finality. A production adapter needs a specified verification mechanism.

## Source verification

The Sepolia outbox emits requests without escrowing ETH. The relay checks configured source identity, contract bytecode, owner, canonical receipt and event fields after six confirmations. It trusts configured RPC data; V3 does not verify Ethereum consensus or finalized checkpoints. The V3 source domain is generic and the relay supplies the binding to Sepolia.

## Test evidence

`npm test` runs 19 checks over actual local EVM transactions, transfer rollback, reentrancy, spending and quarantine rules, V3 bytecode wrapper validation and server input/idempotency guards. Public V3 deployment and transaction evidence is recorded separately in `artifacts/v3-live-evidence.json`, `artifacts/v3-console-e2e.json` and `artifacts/v3-attack-demo.json`.

The controlled 4 tPOT request was quarantined, paused and cancelled with zero payout during the scenario. Guardian pause finalized after the 120-second quarantine because funding recovery was required. This demonstrates the mechanisms, not a response within the delay. The current preflight reserves peak pause storage funds plus a margin. Local adversarial tests do not establish that every adversarial scenario was exercised on public testnet.
