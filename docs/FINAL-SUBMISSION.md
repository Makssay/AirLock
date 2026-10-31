# Final submission draft

## One-sentence overview

Airlock is a cross-chain payout firewall on Portaldot V3 that enforces spending limits, quarantines larger requests and gives an independent guardian control over treasury releases.

## Current progress

Working V3 treasury contract and Sepolia outbox integration through a six-confirmation trusted RPC relay. The existing public testnet receipts show a 0.25 tPOT payout and a separate 4 tPOT request that was quarantined, paused and cancelled with zero payout during that controlled scenario.

The local operator console now includes Guardian watch with request details, eligibility times, optional browser notifications and stale-state protection. A separate terminal observer supports read retries and warns when state or history cannot be verified. Signing preflight checks peak storage deposits independently of net storage charges.

The full regression suite passes 25 checks. A reproducible local Anvil scenario additionally exercises normal and delayed payouts, guardian alerting, pause before eligibility, cancellation, delayed resume, nonce replay and split-budget enforcement. Its 9 assertions pass. Local evidence is clearly separated from V3 receipts.

## Links

- Repository: https://github.com/Makssay/AirLock
- Product: https://airlock-v3-by-makssay-and-kuznets.vercel.app/
- Video: https://youtu.be/LKbyCsM62rQ
- Pitch deck: https://github.com/Makssay/AirLock/blob/main/public/airlock-pitch-deck.pdf
- Testnet evidence: https://github.com/Makssay/AirLock/blob/main/artifacts/v3-attack-demo.json
- Local scenario: https://github.com/Makssay/AirLock/blob/main/artifacts/local-final-scenario.json

## Why Portaldot

The treasury and enforceable payout policy live on V3. Sepolia supplies the instruction; V3 determines whether funds can be released. Guardian controls use native Substrate calls through Revive. The open integration guide provides a starting point for other treasury teams.

## Remaining work

Fresh timely-response and legitimate delayed-payout evidence on public V3; visual/browser validation of the new notification panel; external notification delivery and unattended monitoring; user pilot; official mainnet compatibility confirmation. The current real testnet run proves pause/cancel mechanics; the timely-response assertion currently has local evidence only.

## Business hypothesis

Initial users are teams automating treasury payouts through relays. The hypothesis is an open contract module with optional paid monitoring and operational support. Pilot demand and pricing are not yet validated.

This is prepared text for the user to review and submit. It has not been sent to DoraHacks or organizers automatically.
