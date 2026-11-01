# Demo and Q&A runbook

## Three-minute presentation

0:00–0:25 — A treasury needs spending rules and independent oversight even when its relay is authorized.

0:25–0:45 — Show Sepolia → relay → V3. The source supplies instructions; Portaldot executes the treasury policy.

0:45–1:20 — Open **Stop a suspicious request · Recorded Portaldot V3**. Show the earlier 0.25 payout, the separate controlled 4 request, guardian pause and cancellation. The controlled treasury remains 48.75. Expand one receipt.

1:20–2:00 — Click **See a legitimate payout**. Say “this is a separate local Anvil contract run, with time advanced for the demonstration.” Show the 2 request queued, the read-only TooEarly rejection, and the successful delayed release. The recorded local treasury moves from 49.75 to 47.75.

2:00–2:35 — Show operator capabilities: Telegram notifications, pause/resume funding readiness and recovery of an existing source request after interruption. Explain that actions are checked again before signing. Do not create a new testnet request for the presentation.

2:35–3:00 — Offer the integration guide and a pilot with a team already automating treasury payouts.

## Before the session

- Open the public walkthrough, existing YouTube video, receipt JSON and repository in advance.
- Run `npm test`, `npm run demo:local:final`, `npm run build:public` when code changes warrant it.
- Open the local console; allow history to catch up. Only enable browser notifications if desired. Never show terminal windows containing wallet secrets.
- If RPC fails, use the recorded walkthrough and video. Explain which evidence is recorded.
- Do not run `--send-testnet` without a successful budget preflight and reconciliation of existing journals.
- Ask the host in advance about presentation/Q&A format and language assistance.

## Short answers

**Is this a bridge?** It is a treasury control layer for cross-chain payout instructions. The reference relay trusts RPC data; it is not a consensus-proof bridge.

**What if the large payout is legitimate?** It waits until eligible and can execute subject to the spending budget, pause state and reserves.

**Who responds during quarantine?** The independent guardian. A separate read-only observer can send Telegram alerts while its host is running. The operator reviews and confirms actions through the console.

**Can the relay bypass quarantine by splitting requests?** Each immediate payout still consumes the cumulative fixed-window budget; queued execution also consumes it. A fixed-window boundary can permit a burst across two windows.

**Why use V3?** The treasury, payout rules and native guardian operations are executed on V3, making the controls part of settlement.
