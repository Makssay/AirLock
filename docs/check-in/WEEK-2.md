# Airlock — Week 2 check-in

## One sentence
Airlock is a payout firewall on Portaldot V3 that limits relay authority with a spending cap, quarantine and an independent guardian.

## Who needs this
Teams that hold treasury reserves on Portaldot and accept cross-chain payout instructions. If a trusted relay submits a bad instruction, signature authorization alone does not express how much it should be allowed to withdraw.

## Completed
- Solidity firewall deployed on Portaldot V3, chain 420420777.
- Ethereum Sepolia request emitter and RPC-based relay with six canonical confirmations.
- Real 0.25 tPOT payout in an earlier cross-testnet run.
- Controlled 4 tPOT request quarantined, guardian pause finalized and request cancelled. Payout during this scenario: 0 tPOT. Vault before/after: 48.75 tPOT.
- Local interface with live finalized state, recorded evidence walkthrough and operation journal.
- 46 passing regression tests and production frontend build.

## Why Portaldot
The treasury and payout rules live on Portaldot V3. The deployed EVM contract enforces limits over native tPOT; the guardian signs native Substrate calls through Revive. Sepolia is the external source of requests. This demonstrates V3 contract execution and a real cross-testnet application flow without claiming native trustless interoperability.

## Architecture
![Architecture](architecture.svg)

## Testnet evidence
V3 contract: `0x3bbb62bf86d40f26a87e70fe56ee073e69198713`

| Operation | Transaction hash |
| --- | --- |
| Earlier normal payout | `0xd0e326007397ba7fd52c474ed0a18a9dc5adba3f4a667f5c425c8e9605c22605` |
| Controlled 4 tPOT request on V3 | `0x5a750dbc0a56aa20c8a2e1a60c27f5d228cb03ba58c92d080aa27f2a7d4d90cb` |
| Guardian pause | `0x2f3a2db1706bc553449e6730e6667ba103c00f9fb53430f5d5057e59a5a25ffb` |
| Guardian cancellation | `0xdb15343549fbecc50cb6a06c2f9e63733e7cc21054a3d8c2774cb99b98142821` |

[Source request on Sepolia](https://sepolia.etherscan.io/tx/0xff5a87b865aba5ad632e7e4b02a87de864b0f0bbf37c34536729b6935259f327). V3 node console: https://node-console.portaldot.dev/ (provided by organizers; no fabricated per-transaction explorer URL).

Full machine-readable evidence: [recorded demo](../../artifacts/v3-attack-demo.json), [earlier cross-testnet run](../../artifacts/v3-console-e2e.json).

## Limitations and lessons
This is a testnet prototype, not an audited bridge. The outbox emits instructions and does not escrow ETH. The relay trusts configured RPC data; six confirmations are not an Ethereum finalized checkpoint or consensus proof. The immutable V3 contract has a generic source domain and does not itself bind Sepolia chain/contract identity.

A compromised relay can spend the permitted budget in small requests. Fixed-window boundary bursts, a guardian that reacts late and denial of service by filling the queue remain risks. A 4 tPOT cancelled request is not evidence that the entire reserve was saved.

The initial guardian pause preflight was rejected before signing due to insufficient storage funds. We returned 3 tPOT relay surplus to the guardian, then finalized pause and cancellation. **The pause in this run happened after the 120-second quarantine had expired.** The run proves quarantine, pause and cancellation mechanics; it does not prove a timely emergency response. The new preflight reserves the peak pause storage deposit plus a margin.

## Remaining work before final submission
- Improve guardian alerting and response readiness; validate a response inside the quarantine window.
- Extend adversarial integration coverage, especially split payments and fixed-window boundaries on public testnet as funding permits.
- Make source configuration binding and trust assumptions easier to inspect; evaluate stronger source verification separately.
- Improve operator onboarding, failure reconciliation and public read-only viewing.
- Obtain organizer confirmation on track fit for a custom trusted relay.
- Final documentation, pitch deck and final video.

## Video
Local file: `airlock-week2.mp4` (2:25, English synthetic narration). It uses actual application screens backed by recorded finalized evidence. Upload it to obtain a public viewing link before submitting.

## Submission readiness
Prepared locally. Nothing in this folder has been uploaded or submitted.
A public GitHub URL and a publicly accessible video URL must be added to the DoraHacks submission by the team. Localhost and local file paths are not public demonstration links.
