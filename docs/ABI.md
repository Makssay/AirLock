# Airlock wire ABI v1

This is a custom fixed-width ABI for the legacy Portaldot seal0 runtime, not ink! metadata or an Ethereum ABI. `lib/abi.mjs` is the client encoder/decoder. All integers are unsigned little-endian. Account IDs and hashes are 32 raw bytes. Amounts are u128 native POT base units (14 decimals on the inspected network). Time is u64 milliseconds.

## Constructor: 184 bytes

relay32, guardian32, allowedSourceDomain32, instantThreshold16, windowCap16, quarantineDelay8, fixedWindowDuration8, policyActivationDelay8, reserveFloor16, maxPendingReservation16.

Relay and guardian must be distinct and nonzero. Window duration, activation delay, source, role addresses and floor are immutable. Constructor balance must cover the floor.

## Calls

| Selector byte | Operation | Remaining input |
|---|---|---|
| 0 | Read state | none |
| 1 | Submit release | domain32, nonce8, recipient32, amount16 |
| 2 | Execute queued message | messageKey32 |
| 3 | Guardian cancellation | messageKey32 |
| 4 | Guardian pause | none |
| 5 | Schedule policy | instant16, cap16, delay8, maxPending16, resume1 |
| 6 | Activate scheduled policy | none |
| 7 | Read message | messageKey32 |
| 8 | Guardian cancels pending policy | none |

Message key = BLAKE2b-256(0x4d || domain32 || nonce8). Recipient and amount cannot be replaced under an accepted nonce. Both released and cancelled records remain in storage, preventing reuse. Relay authenticity beyond the caller check is explicitly trusted: no external-chain inclusion proof is verified in v0.1.

Events are 49 bytes: eventKind1, messageKey32, amount16. Kinds: 1 queued, 2 released, 3 cancelled, 4 paused, 5 policy scheduled, 6 policy activated, 8 policy cancelled. Events are pallet Contracts events with no topics. State and message encodings are described in `contracts/airlock/src/lib.rs` and decoded by the shared client.

Error returns use REVERT flag 1 and a one-byte code. The stable code map is exported as `ERRORS` in `lib/abi.mjs`.
