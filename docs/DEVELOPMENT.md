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
