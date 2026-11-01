# Final submission draft

Team: **MaksSay & Kuznets**. Submitted track, confirmed by the team: **Multi-Chain & Cross-Chain Infra**. Keep the original product URL in the existing DoraHacks submission; Pages is the backup.

## One-sentence overview

Airlock is a cross-chain payout firewall on Portaldot V3 that enforces spending limits, quarantines larger requests and gives an independent guardian control over treasury releases.

## Current progress

Working V3 treasury contract and Sepolia outbox integration through a six-confirmation trusted RPC relay. The existing public testnet receipts show a 0.25 tPOT payout and a separate 4 tPOT request that was quarantined, paused and cancelled with zero payout during that controlled scenario.

The local operator console now includes Guardian watch with request details, eligibility times, optional browser notifications and stale-state protection. A separate terminal observer supports read retries and warns when state or history cannot be verified. Signing preflight checks peak storage deposits independently of net storage charges.

The full regression suite passes 53 checks. A reproducible local Anvil scenario additionally exercises normal and delayed payouts, guardian alerting, pause before eligibility, cancellation, delayed resume, nonce replay and split-budget enforcement. Its 9 assertions pass. Local evidence is clearly separated from V3 receipts.

## Links

- Repository: https://github.com/Makssay/AirLock
- Product (original submission URL): https://airlock-v3-by-makssay-and-kuznets.vercel.app/
- Backup mirror: https://makssay.github.io/AirLock/
- Video: https://youtu.be/LKbyCsM62rQ
- Pitch deck: https://github.com/Makssay/AirLock/blob/main/public/airlock-pitch-deck.pdf
- Testnet evidence: https://github.com/Makssay/AirLock/blob/main/artifacts/v3-attack-demo.json
- Local scenario: https://github.com/Makssay/AirLock/blob/main/artifacts/local-final-scenario.json

## Why Portaldot

The treasury and enforceable payout policy live on V3. Sepolia supplies the instruction; V3 determines whether funds can be released. Guardian controls use native Substrate calls through Revive. The open integration guide provides a starting point for other treasury teams.

## Testnet deployment details

Portaldot V3 testnet, chain ID **420420777**.

- Treasury contract: `0x3bbb62bf86d40f26a87e70fe56ee073e69198713`
- Deployment: native Substrate extrinsic `0x23d1230a3897b65591474b2dadadf7fecc12e6ec34f373474f9c26535bb06e54`, finalized block **146537**. It is a native Revive deployment, not an Ethereum deployment transaction.
- Earlier 0.25 tPOT payout: EVM transaction `0xd0e326007397ba7fd52c474ed0a18a9dc5adba3f4a667f5c425c8e9605c22605`.
- Controlled 4 tPOT queued request: EVM transaction `0x5a750dbc0a56aa20c8a2e1a60c27f5d228cb03ba58c92d080aa27f2a7d4d90cb`.
- Guardian pause: native extrinsic `0x2f3a2db1706bc553449e6730e6667ba103c00f9fb53430f5d5057e59a5a25ffb`.
- Cancellation: native extrinsic `0xdb15343549fbecc50cb6a06c2f9e63733e7cc21054a3d8c2774cb99b98142821`.
- Sepolia outbox: `0x92eB46a2a0F8644Ec13fFbD2d7Cb61762c3A95fE`, source chain ID **11155111**.

The recorded controlled scenario ended with 48.75 tPOT in the treasury, zero paid during that scenario and no remaining reservation. Full native events, EVM receipts and source transaction references are in the linked evidence files. Use the native block/extrinsic records for native hashes; an empty Ethereum receipt alone is not a failed native transaction.

## Demo video field

https://youtu.be/LKbyCsM62rQ — 2:23, English narration; recorded V3 interactions and the cross-chain payout workflow.

## Pitch deck field

https://github.com/Makssay/AirLock/blob/main/public/airlock-pitch-deck.pdf — six-slide PDF covering the problem, V3 execution, product evidence and roadmap.

## Remaining work

Fresh timely-response and legitimate delayed-payout evidence on public V3; visual/browser validation of the new notification panel; external notification delivery and unattended monitoring; user pilot; official mainnet compatibility confirmation. The current real testnet run proves pause/cancel mechanics; the timely-response assertion currently has local evidence only.

## Business hypothesis

Initial users are teams automating treasury payouts through relays. The hypothesis is an open contract module with optional paid monitoring and operational support. Pilot demand and pricing are not yet validated.

This is prepared text for the user to review and submit. It has not been sent to DoraHacks or organizers automatically.

Guardian update: Telegram private-chat delivery has been tested; an independent read-only observer runs on the development machine with persistent reminders, outcome notifications and outage alerts. The operator UI adds action-specific pause/resume readiness checks and current payout blockers. Continuous hosting and full request-to-notification-to-guardian V3 evidence remain separate from the chat transport test.

Cross-chain reliability update: the operator console now reconciles saved source/destination transactions after interruption and can explicitly relay the original verified source event. Unknown destination hashes block replacement. Recovery is covered by fixture and signing tests; no new public-testnet recovery run is claimed.

The interactive public walkthrough now contains two selectable scenarios: recorded Portaldot V3 protection receipts and a separately labelled local Anvil legitimate delayed payout. The latter includes captured queue/release snapshots and a read-only TooEarly execution check. The existing YouTube video remains the earlier recorded V3 demo.
