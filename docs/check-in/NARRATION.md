# Airlock Week 2 narration

Approved presentation script. English voice: Gemini Flash TTS / Fenrir through OpenRouter. Recorded public-testnet evidence.

## 1. The problem

What if your relay starts sending the wrong payout instructions? To a treasury, those requests can still look legitimate. They come from a trusted intermediary. But being allowed to submit a request shouldn't mean unlimited access to the funds.

## 2. The solution

Airlock is a payout firewall on Portaldot V3. It sets clear boundaries: how much can be paid immediately, how much can leave within a fixed window, and which requests have to wait. A separate guardian can pause payouts and cancel a request.

## 3. Normal payout

Let's follow a real flow between Ethereum Sepolia and Portaldot V3. A request is created on Sepolia. The relay waits for six confirmations, then submits it to Airlock. A small payout of zero point two five test tokens goes through. The result is confirmed by a transaction on Portaldot V3.

## 4. Quarantine

Now a request comes in for four tokens. That's above the instant payout threshold, so it enters quarantine. Airlock reserves the amount, while the funds stay in the treasury. Other payouts can't spend that reserved balance.

## 5. Guardian response

The guardian reviews the request and pauses payouts. This doesn't require the relay's permission. The guardian has separate authority to protect the treasury. While payouts are paused, the queued request cannot be executed.

## 6. Cancellation

The guardian then cancels the four-token request. The reservation is released, and that same request can never be executed again. The result: four tokens cancelled, zero paid during this scenario, and forty-eight point seven five tokens still in the treasury. Each stage is backed by contract addresses, transaction hashes, and finalized blocks in the interface.

## 7. Why Portaldot

Airlock's rules execute in a contract on Portaldot V3. This is where the treasury lives, payout limits are checked, and pause and cancellation take effect. Sepolia is the source of requests, and the relay carries them between networks. These are results from a real run across two public testnets.

## 8. Next milestone

Next, we're adding guardian notifications, continuous queue monitoring, and easier policy configuration for each team's workflow. Airlock lets a treasury accept requests from another chain while keeping control of payouts on Portaldot.

## Presentation notes

This is the user-approved presentation script. It describes confirmed payout, quarantine, pause and cancellation mechanics without claiming a response within a measured deadline. Technical assumptions and the historical funding recovery remain documented in WEEK-2.md, the threat model and original transaction records.
