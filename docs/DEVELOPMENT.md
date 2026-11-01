# Development record

This folder contains the current Portaldot V3 / EVM implementation. Older Rust/WASM laboratory code, network research dumps, local journals, wallet files, screenshots, video production tools and rendered media are excluded. Runtime evidence and compiled EVM artifacts used by the application and regression tests are included.

## Milestones from the original Git history

| Date | Commit | Work |
| --- | --- | --- |
| 2026-10-16 | b41c2dc | Record supplied V3 endpoints and DNS verification status |
| 2026-10-21 | af7b2d5 | Prepare verified V3 deployment with separate relay and guardian signing |
| 2026-10-22 | ace7243 | Deploy Airlock on V3 and record finalized smoke-test evidence |
| 2026-10-22 | 551e6e4 | Run the interface on V3 and relay verified Sepolia outbox requests |
| 2026-10-22 | e149803 | Demonstrate quarantine and guardian recovery with verified receipts |
| 2026-10-22 | b17b877 | Prepare judge walkthrough and architecture |
| 2026-10-22 | 90eb947 | Render the approved narrated demo |
| 2026-10-22 | 6ddd0a1 | Simplify demo overlays |

The original development commit history is preserved in this repository. The current version removes retired code and production media tools from the working tree; earlier implementations remain accessible through Git history.

## Source-package verification

A separate fresh copy passed `npm ci`, all 19 regression checks and `npm run build`. The production server returned the application, recorded walkthrough and live V3 state without wallet keys. The V3 contract was verified as `0x3bbb62bf86d40f26a87e70fe56ee073e69198713`. Balances are live observations, not fixed guarantees.

## Next work

Guardian alerting, response within quarantine, additional public-testnet adversarial coverage, operator onboarding and stronger source verification. See [Week 2 progress](check-in/WEEK-2.md).

## 2026-11-01 final preparation

Added a terminal observer and local Guardian watch UI, optional browser notifications, explicit incomplete-history status, stale-state write blocking and bounded historical catch-up. Corrected native signing affordability to cover peak storage deposits. Native jobs record finalized block timestamps before reporting completion.

Added an isolated local final scenario, separate from testnet evidence: normal and delayed payouts, guardian alert, pause 110 seconds before eligibility, cancellation, timelocked resume, replay rejection and split-budget enforcement. All 25 regression checks and 9 local scenario assertions passed. New V3 transactions remain pending due to the existing operator funding constraint, documented in FINAL-PLAN.md. No additional tokens are assumed.

Browser automation was stopped by automatic URL verification; visual validation of the new panel remains open. Production claims are based on existing V3 receipts and explicitly labelled local checks.

## Nov 1 — Telegram guardian delivery

Added an independent read-only observer with a separate history journal, persisted notification queue and exclusive process lock. Notifications cover queue entry, 60/15-second reminder stages, eligibility, pause/resume, tracked release/cancellation and outage/recovery. Telegram uses plain text and bounded retry-after backoff; transport errors are sanitized. Six new delivery/projection checks pass; full suite: 33 checks passing. Live dry-run and actual chat delivery status are recorded separately in FINAL-PLAN.md. No signing keys are needed on the notification host.

## Nov 1 — Cross-chain recovery

Implemented source receipt revalidation and destination reconciliation, an inspect/continue operator panel, serialized recovery requests and preserved reverted destination history. Recovery derives the original nonce from the source event and never creates a replacement Sepolia request. Added 11 recovery tests, including exact signed transaction decoding with an unfunded fixture key and a mocked broadcaster. Historical source RPC inspection remained waiting because the receipt was absent; no new transaction was sent.

## Nov 1 — Two-scenario interactive demo

Added independent V3 protection and local Anvil legitimate-payment paths with a guided switch between them. The local scenario now captures block-pinned queue/release/protection snapshots and the exact TooEarly rejection. New evidence projection rejects wrong networks, missing receipts, premature releases and incorrect balance deltas; server rendering verifies environment labels and distinguishes read-only calls from transactions. Full suite: 53 passing checks. Updated English/Russian presentation scripts; existing YouTube upload is unchanged.

## Nov 1 — Public educational treasury playground

Added Try Airlock with virtual funding, four payout scenarios, guardian actions, shortened demo policy delays and real Telegram pairing/delivery. Vercel proxies only whitelisted session operations to an owner-private Sites Worker backed by D1. The cloud state uses revision compare-and-swap, bounded session lifetime, request idempotency and delivery leases. No blockchain signing keys are configured in either playground service. Full suite: 66 checks passing. Cloud and public API funding/pair-link creation verified; real chat-cycle verification follows the user Start action.

Added single-use five-minute Telegram review handoffs for opening the same virtual treasury on a second device while retaining desktop access. Full suite: 68 passing checks; public expired-handoff handling and both updated site bundles verified. User-driven Telegram acceptance remains pending a fresh Start action.

## Nov 1 — Live Telegram acceptance

After the user pressed Start on a fresh one-time link, the public API completed the suspicious request queue/pause/cancel sequence and a legitimate delayed 2-token payout, with TooEarly rejection before expiry. Telegram accepted all seven notifications on their first attempt. Final virtual balance 48, paid 2, reserved 0. Sanitized simulation evidence is in artifacts/playground-live-cycle.json; this is not blockchain or browser-click evidence.

## Nov 1 — Documentation languages

Made English the primary business-model and pitch language, with separate Russian translations under docs/ru and language navigation from the README and translated documents. Consolidated the Russian demo script into the same translation directory. Application code and business assumptions are unchanged.
