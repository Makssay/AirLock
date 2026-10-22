# Video narration

English synthetic narration, Microsoft Zira Desktop. Recorded evidence; no new transactions.

## 1. Why Airlock?

Teams hold a treasury on Portaldot, but accept payout instructions from another chain. If the trusted relay is compromised, a valid relay signature can still authorize a bad request.

## 2. The boundary

Airlock puts payout rules on Portaldot V3. Small requests can pass within a budget. Larger requests wait in quarantine. A separate guardian can pause and cancel. The diagram explains the architecture, not a measured loss comparison.

## 3. Normal payout

First, an earlier real request from Ethereum Sepolia. The relay checks the event after six canonical confirmations. On Portaldot V3, the quarter-token payout is released. This is a recorded walkthrough, not a new transaction.

## 4. Quarantine

Next, a controlled four-token request to the guardian wallet models an untrusted relay instruction. It exceeds the one-token instant threshold. The contract queues it and reserves four tokens. The treasury balance stays at forty-eight point seven five.

## 5. Guardian response

The independent guardian pauses releases. Our first pause preflight rejected before signing because the guardian needed a storage deposit. Funding recovery delayed this pause beyond the quarantine window. We record that limitation instead of claiming a timely response.

## 6. Cancellation

The guardian then cancels the request. Its nonce stays consumed. Zero tokens were paid during this scenario, and the vault remained at forty-eight point seven five. The interface exposes the actual transaction hashes and finalized blocks.

## 7. What this proves

This prototype demonstrates a real cross-testnet request, quarantine, independent pause and cancellation. It does not verify Ethereum consensus. The relay still trusts RPC data. Small malicious payouts inside the cap remain possible. This is not an audited bridge.

## 8. Next milestone

Before the final submission, we will focus on guardian alerts, response inside the quarantine window, stronger adversarial integration tests and clearer operator recovery. Airlock makes the limits of relay authority visible and enforceable on Portaldot.