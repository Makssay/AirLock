# Demo and Q&A runbook

## Three-minute presentation

0:00–0:25 — A relay is authorized to submit instructions, but a treasury still needs its own spending rules. Airlock gives treasury teams a payout budget, a review window and independent guardian controls.

0:25–0:55 — Show Sepolia → relay → V3. Point out where the treasury lives and where limits are enforced. The relay checks its configured RPC after six confirmations; V3 enforces the destination policy.

0:55–1:40 — Show the recorded V3 walkthrough: earlier 0.25 payout, separate 4 request queued, guardian pause and cancellation, zero payout during that controlled run. Inspect the linked receipts.

1:40–2:15 — Show Guardian watch: request amount, recipient and eligibility, optional notifications, stale-state warning. Explain that the operator reviews the request and confirms the response.

2:15–2:40 — If presenting the local verification report, say explicitly “this next scenario is local Anvil.” It proves the contract sequence with a 110-second pause margin using explicitly advanced local time, legitimate delayed release, replay and budget checks. It is not additional V3 execution evidence.

2:40–3:00 — Close with the next pilot: a team already using an automated treasury payout relay. Offer the integration guide and ask for feedback on the operating workflow.

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

**Who responds during quarantine?** The independent guardian. Current local alerts help them review; a permanently hosted monitoring service remains future work.

**Can the relay bypass quarantine by splitting requests?** Each immediate payout still consumes the cumulative fixed-window budget; queued execution also consumes it. A fixed-window boundary can permit a burst across two windows.

**Why use V3?** The treasury, payout rules and native guardian operations are executed on V3, making the controls part of settlement.
