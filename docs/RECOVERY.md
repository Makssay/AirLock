# Continuing an interrupted cross-chain request

Open the local operator console's **Control room** or **Evidence** page. Requests with a saved Sepolia hash and an unresolved/failed operation show a recovery panel.

1. Click **Inspect saved request**. This reads both networks and updates the local journal without signing.
2. The source check verifies the configured chain, outbox code and immutable roles, the original transaction hash, sender, a single matching payout event, amount, recipient, destination, six confirmations and the canonical source block. It derives the original destination nonce from that event.
3. The destination check uses the native finalized height and the EVM gateway's receipt and contract state. A saved destination transaction must match the authorized relay, V3 contract, chain, zero value and the exact submit arguments. Native and EVM block hashes are not compared with one another.
4. If the request already exists on V3, the operation is reconciled. A queued, released or cancelled request is never submitted again.
5. If the original source is verified and no destination message exists, the panel offers **Relay existing request on V3**. A known destination hash must have a canonical finalized reverted receipt before it can be replaced. An unresolved hash always remains waiting. A message seen only at the gateway tip also remains waiting.
6. Continuing repeats source and destination checks, verifies active releases and operator fee limits, then signs only the V3 relay transaction. It does not create another Sepolia request. Prior reverted destination hashes remain in `destinationAttempts`.

The server serializes recovery with other operations and deduplicates recovery request IDs. An independent guardian can still pause while a source/relay operation is pending. A restarted recovery must be inspected again. Normal transaction finality and uncertain-write safeguards also apply to resumed submissions.

## Status meanings

| Status | Meaning |
| --- | --- |
| `waiting` | Source confirmations, a destination receipt or finality are still unavailable. No replacement is sent. |
| `resumable` | Inspection found a verified source event and no accepted destination message. Continuing performs fresh checks. |
| `completed` | The destination operation completed or its existing effect was reconciled. |
| `blocked` | A mismatch, pause, funding issue or verification failure prevents continuing. Inspect again after resolving it. |
| `interrupted` | The server restarted during inspection or relay. Inspect saved hashes again. |

`reconciled` is a local job status indicating that the matching finalized contract message exists; it does not invent a successful receipt for a reverted or missing transaction hash. A successful matching receipt uses `finalized`.

Source RPC data remains trusted under the reference relay model. Recovery does not supply an Ethereum consensus proof or prove that the source has never reorganized after checking. Keep the same configured lane and journal. Do not clear unknown hashes or generate a new source request to bypass an unresolved operation.

## Validation scope

Recovery tests cover missing receipts, six confirmations, canonical blocks, event/amount mismatches, accepted/cancelled destination messages, tip-only state, unresolved hashes, paused releases, serialized/idempotent admission and signing the original nonce. Telegram and recovery tests do not require production wallet credentials. The signing fixture uses a disposable unfunded key and a mocked broadcaster.

A Nov 1 read-only check of the historical Sepolia source hash returned no receipt from the configured RPC. It correctly remained `waiting`. This is not a successful public-testnet recovery demonstration. No recovery transaction was sent during this implementation.
