# Airlock v0.1 threat model

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
- Records grow with unique accepted messages. Tests bound value exposure, not indefinite storage growth, spam fees or legacy contract rent.
- The legacy pallet may charge storage rent or evict underfunded contracts. The reserve floor is a configured amount, not an automatically calculated rent guarantee. Host tests do not emulate fees, rent, consensus, block limits, reorgs or validator behavior.
- The inspected legacy seal_transfer transfers currency without invoking recipient contract code. The Solidity reference uses native calls that can invoke code, so every mutating entry point has a reentrancy guard; EVM tests cover a recipient attempting a nested queued release and a recipient rejecting payment.
- Fixed source domain labels and nonces do not prove source finality. A production adapter needs a specified verification mechanism.

## Test evidence

Node's WebAssembly runtime runs the exact compiled Rust artifact against a local host implementing seal0 storage, clock, caller, balance, transfer, events and BLAKE2. Revert snapshots emulate transaction atomicity. The suite includes deterministic mixed adversarial actions and conservation/reservation invariants. This is contract execution evidence, not proof of successful Portaldot deployment. Legacy validation and actual on-chain deployment remain separate checks.
