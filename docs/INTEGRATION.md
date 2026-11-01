# Integrating a treasury payout source

## Example user

A team runs an automated payout service. Its source system creates recipient instructions; its treasury lives on Portaldot V3. The team wants a spending budget and a review interval for larger requests, with a separate operator able to stop releases.

## Current reference flow

1. The configured owner calls `AirlockOutbox.requestRelease(amount)` on Sepolia. The reference outbox fixes the destination and recipient; it emits an instruction and does not escrow ETH.
2. The relay checks the source chain, contract bytecode, owner, destination and event contents. It waits for six confirmations and checks the source block hash. See `server/source-lane.mjs`.
3. The reference lane encodes the nonce as `(11155111n << 32n) | sourceEventNonce`, with a positive source nonce of at most 32 bits. This mapping is specific to this lane, not a universal multichain encoding.
4. The immutable authorized relay calls `Airlock.submit(sourceDomain, nonce, recipient, amount)` on V3. Amounts are EVM units (18 decimals); native funding uses 14 decimals. Do not pass raw native amounts to the EVM interface.
5. The contract either releases within policy or queues the request. A separate guardian monitors requests, pauses releases and cancels unauthorized requests. Once a legitimate request is eligible, execution remains subject to the pause, budget and reserve checks.

The V3 contract enforces destination policy. Source authenticity is trusted to the relay and its RPC checks; the destination does not verify Ethereum consensus. Configure a new deployment for a different immutable relay/guardian/source domain; the shared demonstration treasury is not an onboarding endpoint for third-party funds.

## Operator setup

Inspect the pinned network identity and bytecode before signing. Keep guardian and relay keys separate. Estimate network fees, net storage charge and transient peak storage independently. Run `npm run guardian:watch` with the local console for terminal alerts. Complete event-history synchronization before relying on full coverage.

For ambiguous transaction results, use **Inspect saved request** in the operator console. If fresh verification finds the original event and no accepted destination message, explicitly continue it with **Relay existing request on V3**. Unknown hashes remain blocked from replacement. See [recovery](RECOVERY.md).

## Pilot acceptance

Use a disposable test treasury. Demonstrate a normal payout, a legitimate delayed payout, replay rejection, cap enforcement and an unauthorized request stopped before its eligibility time. Preserve finalized receipts and exact balance changes. A pilot user and paid monitoring demand have not yet been validated.
