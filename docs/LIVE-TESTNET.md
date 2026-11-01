# Live testnet operator run

[English](LIVE-TESTNET.md) | [Русский](ru/LIVE-TESTNET.md)

The `#testnet` page uses Ethereum Sepolia and the existing Portaldot V3 treasury. It is a shared team-operated test treasury, not a personal vault for every visitor. The separate `#try` page remains a wallet-free simulation.

## Delivery plan

1. Inspect both pinned networks and deployed code, balances, pause and policy state.
2. Connect the Sepolia outbox owner's EVM wallet. Save a source transaction hash immediately and inspect that same transaction after reload; never silently create a replacement.
3. Relay only the configured outbox owner's canonical event after six confirmations. Preserve a durable signed-transaction journal before broadcast. Serialize relay transactions and reconcile uncertain results before allowing another signature.
4. Connect the existing native guardian through a compatible browser wallet. Simulate every action, cover peak storage plus fees, and request the wallet signature. Keep guardian and source signing keys out of hosting.
5. Show source confirmations, finalized destination state, quarantine, cancellation and legitimate release. Use the existing independent Telegram observer for actual V3 notifications.
6. Run a fresh protected-payment and legitimate-payment scenario when operator funds allow it; publish new receipts separately from existing evidence.
7. Update the English video and PDF, with separate Russian text, using verified new results. Do not label an unexecuted run as live evidence.

## Current funding constraint

The latest read-only check on November 1 found 48.75 tPOT in the paused treasury, 5.01908574072156 native tPOT available to the guardian, and a transient 11.5245 tPOT storage requirement to schedule resumption, before the fee and margin. The contract has no administrative withdrawal. Keep these figures as dated observations and refresh before signing.

The team cannot currently request additional faucet funding. Continue implementation and verification without assuming funding will arrive. New transactions must wait for affordable successful simulation; do not weaken the existing contract policy or substitute simulated receipts.

## Signing and operation

- The source outbox is owner-restricted; connecting another EVM account does not authorize it.
- The native guardian is `5HKTe2e7hXWUN6gfreN9dMGQ3TBjqeVbkMzFAFpCaxfvXnQZ`. Its browser extension signs only after an explicit action.
- The dedicated relay currently runs as a separate local process. Only it opens the existing V3 testnet relay key. No signing key is installed on Vercel or the cloud playground. A future hosted relay would require separate provisioning and operational validation.
- The existing real V3 Telegram observer requires its host to stay running. Playground notifications have independent cloud hosting.
- Six canonical Sepolia confirmations establish the relay's RPC-based acceptance rule; they are not Ethereum consensus verification on Portaldot.

## Acceptance

Check unauthorized wallets, wrong chains, changed code/roles, invalid source events, reorgs, replay, concurrent relay requests, lost broadcast responses and insufficient storage funding. Preserve the old Week 2 evidence. Final browser/mobile QA and fresh public-testnet receipts are separate from unit tests and builds.

## Start the real relay

Use Node.js 22+ from the source checkout. Keep the existing dedicated relay wallet in an ignored local file; do not create a replacement key for this immutable deployment.

```powershell
npm run relay:testnet -- --send-testnet --wallet path/to/relay-wallet.local.json
```

On its first start the process records the current Sepolia block. It watches later outbox events after six confirmations. Stop with Ctrl+C. The process must stay running during the operator demo. It never reads the guardian mnemonic or source key. Use one signer process for this relay wallet; do not also submit through another operator console or wallet.

Progress and signed bytes are retained in ignored `deployments/testnet-relay.local.json`. The process uses a lock, flushes its journal before broadcasting, and only re-broadcasts the exact same signed bytes after an ambiguous result. It does not automatically replace transactions or retry a finalized revert. Receipt reconciliation verifies canonical EVM inclusion at or below the native finalized height and the corresponding treasury message.

For an explicit existing source request, stop the process, then restart with the same journal and add `--source-hash 0x…`. It verifies the pinned outbox and the exact event before accepting it. Do not erase the journal to bypass an uncertain operation.

This process limits new payout instructions to 10 tPOT over its journal and each relay fee estimate to 5 tPOT, with a 10% gas margin and 0.1 tPOT remaining. These are dedicated-run limits, separate from the older local console's budgets. The browser checks relay affordability before creating a source transaction, and the process checks again before signing.

## Wallet flow

1. Open the public `#testnet` page, or `http://127.0.0.1:5173/#testnet` with the local app.
2. Share the existing native guardian through a Substrate-compatible extension. Schedule resumption with the unchanged policy, wait the immutable 300-second policy delay, then activate it. The browser verifies Revive's raw or single SCALE-wrapped code and simulates peak deposit and fees before asking for a signature.
3. Connect the configured Sepolia owner in an EVM extension and select Ethereum Sepolia. Choose 0.25, 2 or 4 tPOT, review the recipient and sign the zero-value outbox call. The only Sepolia spending is transaction gas, capped by the client's 0.001 test ETH preflight.
4. Keep the source hash. The page follows six source confirmations and the finalized destination message. It never signs a replacement automatically. A recovered hash can be pasted into the recovery field.
5. For the controlled request, pause and cancel through the native guardian wallet. For a legitimate queued payment, wait for eligibility and explicitly execute. No automatic payout is scheduled by the page.
6. Keep the existing V3 Telegram observer running. Notifications go to its configured guardian chat; opening the bot alone does not pair another visitor to this real treasury.

The treasury is shared and the outbox is owner-restricted. There is deliberately no public deposit prompt or visitor-specific funding address. Personal self-service treasuries would need separate contracts, source lanes, operators and funding.

The page stores only source hashes, native transaction progress and a short receipt history in this browser. An ambiguous wallet result remains blocked until its hash/result is inspected. When recovering a source hash without the original V3 starting block, the finalized message can still be checked, but historical destination transaction lookup may be unavailable. With a saved starting block the lookup is bounded to 2,000 V3 blocks.

## Funding recovery check

A read-only November 2 check scanned all 165 uploaded-code records. The guardian owns one code record, with reference count 1, for the existing treasury. There is no unused guardian-owned upload whose deposit can be reclaimed independently of the active contract. No code was removed and no treasury policy was weakened.

Run `npm run testnet:readiness -- --write` to refresh the read-only [readiness artifact](../artifacts/live-testnet-readiness.json). This command opens no signing key and broadcasts no transaction. The funding gap excludes fees and margin and is not a complete transaction budget.
