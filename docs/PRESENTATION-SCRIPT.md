# Presentation script

Suggested English narration. Rehearse at a natural pace and keep the total below three minutes. Use the existing video as fallback; this text is not a new recording.

Airlock gives cross-chain treasury payouts a waiting period and an independent guardian.

Imagine a team that automates payments through a relay. The relay is authorized, but it can still send a wrong instruction. The treasury needs its own rules about how much can leave, when it can leave, and who can stop it.

That is what Airlock enforces on Portaldot V3.

Here is the flow: an outbox on Ethereum Sepolia emits a payout request. Our relay checks the configured source and waits for six confirmations. It then submits the instruction to the treasury contract on V3.

Small payouts can pass within the spending budget. Larger requests enter quarantine. The funds stay in the treasury while an independent guardian has an opportunity to review the request.

In the recorded V3 demonstration, an earlier request paid 0.25 tPOT. A separate controlled request for 4 tPOT entered quarantine. The guardian paused releases and cancelled that request. During the controlled scenario, the treasury paid zero and remained at 48.75 tPOT. The recorded transactions are linked in the demo.

The local control room now includes Guardian watch. It shows queued amounts, recipients and eligibility times, and can notify the operator while the console is open. When fresh state is unavailable, transaction controls are disabled.

We also have a separate local contract scenario covering a legitimate delayed payment, a pause before eligibility, cancellation, delayed resume, replay and split-budget enforcement. Those checks are clearly labelled as local Anvil evidence.

Portaldot is where the treasury and payout rules execute. The source relay supplies an instruction; V3 decides whether the treasury can release it.

Our first target users are teams already automating treasury payouts. We have published the source, receipts and an integration guide, and we are looking for a pilot team to validate the operating workflow.
