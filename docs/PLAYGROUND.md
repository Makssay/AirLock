# Try Airlock

Public entry: https://airlock-v3-by-makssay-and-kuznets.vercel.app/#try

This is an educational simulation with virtual demo tokens and real opt-in Telegram delivery. It never accepts deposits, requests a wallet connection, broadcasts a blockchain transaction or calls the operator signing console.

## Visitor journey

1. Create a personal treasury. A random bearer token is kept in this browser's local storage.
2. Add 50 demo tokens (maximum allowance 100 per session).
3. Click Connect Telegram, open the generated bot link and press Start. No chat ID or bot token is entered in the browser.
4. Try a routine 0.50 payout, suspicious 4.00 request, legitimate 2.00 request, or oversized 40.00 instruction.
5. Pause and cancel an unwanted request, or wait and execute a legitimate one. Early execution returns TooEarly.
6. Observe the activity log and actual notification delivery state. Start a new demo to disconnect the previous chat and create another treasury.

The demo policy uses a 1-token instant threshold, 5-token cumulative cap per fixed 60-second window, 5-token reserve floor, 20-token maximum queue, 20-second quarantine and 10-second resume delay. These deliberately shortened timings are labelled simulation; the recorded V3 policy and receipts are unchanged. Eligibility does not execute a payout automatically.

## Architecture

The Vercel frontend calls `api/playground.mjs`. The proxy restricts origins, derives a client rate-limit key, strips unsupported inputs and adds server-only credentials. It forwards to a private Sites Worker with Cloudflare D1. The browser never receives the private Site access token, internal service credential, Telegram bot token or a wallet key. The GitHub Pages mirror uses the same Vercel API with an explicit allowed origin.

The private backend is https://airlock-sandbox-service-makssay-kuznets.makssay.chatgpt.site. It retains owner-private access. Visitor authorizations use independent 256-bit session tokens; each token sees only its own treasury. Telegram pairing uses a single-use, five-minute link and accepts only a private chat's Start command. Pairing another treasury to the same chat disconnects the old one. Telegram updates arrive at `api/playground-telegram.mjs`, which validates the bot webhook secret before forwarding.

The database stores a bounded demo document with revision-based compare-and-swap updates. Mutations and their outbox records commit together; retrying the same request ID does not repeat the mutation. Concurrent writes retry against fresh state. Session lifetime is one hour; expired records are cleaned on subsequent requests. Capacity is 30 concurrent sessions with per-client and global creation caps. This is a bounded hackathon demo, not a general-purpose production wallet service.

The outbox leases messages before sending, retries failures, replaces pending reminders on cancellation and reports successful delivery only after Telegram accepts the message. The Worker continues delivery after an action/webhook response. Follow-up eligibility/reminder generation also runs on status refreshes; reminder timing while all browser tabs are closed is not guaranteed. No scheduled task or perpetual polling process is required for initial request and outcome notifications. Delivery is at least once: an ambiguous timeout can produce a duplicate.

## Deployment configuration

Vercel encrypted production variables:

- `AIRLOCK_SANDBOX_ORIGIN`: the private backend origin.
- `AIRLOCK_SANDBOX_SERVICE_TOKEN`: internal API credential.
- `AIRLOCK_SANDBOX_SITE_TOKEN`: Sites dispatch service-access credential.
- `AIRLOCK_PLAYGROUND_WEBHOOK_SECRET`: secret validated on Telegram webhook calls.

Private Worker runtime secrets:

- `AIRLOCK_SANDBOX_SERVICE_TOKEN`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`

Neither service uses `SEED`, `PRIVATE` or the relay wallet. The existing V3 observer may continue sending genuine V3 alerts through the same bot; playground messages explicitly start with `Airlock Playground · SIMULATION`.

The public repository contains the simulation model, cloud state engine, CAS/outbox runtime and deployment route/schema snapshots under `services/playground/`. The complete private Worker checkout is maintained separately through the Sites publishing workflow. To reproduce it, initialize the Sites Vinext starter, copy `lib/playground-model.mjs`, `lib/playground-cloud.mjs` and `lib/telegram-watch.mjs` to its lib directory, adapt the runtime imports to that directory, install the route/Worker/schema snapshots in their matching starter paths, enable D1 binding `DB`, generate migrations and deploy with server-only credentials. Keep the starter's Sites and connector handling intact.

## Verification

Tests cover policy limits, early execution, pause/cancel/resume, session isolation, pairing scope/expiry, idempotency, concurrent CAS retries, outbox leases, webhook authorization, CORS, input stripping and initial simulation labels. The private cloud API and public Vercel proxy have both created/funded a treasury and issued a pairing link. The deployed public API passed all four scenarios, including a real 20-second wait before a legitimate execution. User pressed Start on a fresh pairing link. The live public API cycle then queued/paused/cancelled a suspicious request without payout, resumed after the policy delay, rejected early execution and paid a legitimate 2-token request after 20 seconds. Telegram accepted all seven associated notifications with one delivery attempt each. Sanitized results are in `artifacts/playground-live-cycle.json`. Browser visual/click QA remains separate from API and rendering checks.

This deployment uses a persistent cloud Worker and database. The proposed local public-tunnel launch was rejected by automatic review and was not used. No local signing server or wallet credentials were exposed.

Telegram review buttons carry a five-minute one-time handoff in the URL fragment. Redeeming it opens the same treasury on a second device with its own session credential, preserving the original browser. The long-lived session token is not placed in the review URL. Used/expired review links cannot be redeemed again; an idempotent retry can retrieve its already-created credential.
