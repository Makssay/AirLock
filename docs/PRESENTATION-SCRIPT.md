# Two-scenario presentation script

Suggested English narration for the updated interactive walkthrough. Rehearse below three minutes. This is a presentation script; the existing YouTube upload remains the earlier V3 recording.

Airlock lets a treasury stop the wrong payout and complete the right one.

Imagine a team automating payments through a cross-chain relay. An authorized relay can still send a wrong instruction. The treasury needs its own spending rules and a separate person who can intervene.

Airlock enforces those rules on Portaldot V3.

Our reference flow starts with a payout request on Ethereum Sepolia. The relay checks the source and waits for six confirmations. It submits the instruction to the treasury contract on V3, where the spending budget, quarantine and guardian controls apply.

Let us follow two requests.

First, protection. This walkthrough uses recorded Portaldot V3 transactions. An earlier small request paid 0.25 tPOT. A separate controlled request for 4 tPOT entered quarantine. The guardian paused releases and cancelled it. During that controlled scenario, zero was paid and the treasury remained at 48.75 tPOT. Each step links to its receipt.

Now, a legitimate larger payment. This second scenario is a local Anvil contract run, with local time advanced for the demonstration. The 2 tPOT request enters quarantine. An early execution call returns TooEarly. After the waiting period, execution succeeds: the recipient receives 2 tPOT and the reservation is cleared.

Quarantine gives the team a review window. The same rules support both stopping an unauthorized request and completing a legitimate payment.

The operator tools include Telegram alerts, fee and peak-deposit readiness checks, and recovery of interrupted cross-chain requests. Recovery checks the saved source event and destination state before continuing with the original nonce.

Portaldot is where the treasury and payout rules execute. Our next step is a pilot with a team already automating treasury payouts. The source, recorded receipts and integration guide are public.
