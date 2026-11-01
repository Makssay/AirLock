# Airlock final delivery plan

Started 2026-11-01. Source: team plan and the supplied Oct 30 AMA notes.

## Latest status

Implemented: peak-deposit signing preflight, bounded history catch-up, Telegram guardian observer with persistent delivery, readiness simulations, payout explanations, interrupted cross-chain recovery and a two-scenario public walkthrough. Current regression suite: 68 checks passing. Local contract scenario: 9 assertions passing, including a 110-second pause margin and legitimate delayed release. Operator build passes.

Verified Telegram private-chat delivery and recovery from unavailable to fresh finalized V3 observation on the development machine. Continuous operation still requires that host to stay running. The public walkthrough distinguishes historical V3 receipts from the new captured local Anvil queue/release snapshots and read-only TooEarly check.

Prepared: final submission draft, integration/recovery guides, two-scenario English/Russian scripts and Q&A runbook. The English script is 284 words (about 131 seconds at 130 words/minute, before pauses). Existing YouTube upload and pitch PDF remain the earlier published materials. No new public-testnet payout, organizer message or DoraHacks submission was sent.

Open: browser/mobile interaction QA, fresh V3 timely-response and legitimate delayed-payout evidence (funding-constrained), continuous hosting, pilot, mainnet clarification and final submission review.

## Delivery order and acceptance

- [ ] Baseline: run regression tests, both builds, inspect current finalized testnet state and operator balances. Record failures rather than assume availability.
- [ ] Guardian: detect queued requests, expose recipient/amount/deadline, verify gas and peak storage deposit before signing. Notify without automatic signing.
- [ ] Testnet proof: normal Sepolia-to-V3 payout; queued request; pause finalized before eligibility; cancellation; unchanged vault balance for that request. Also demonstrate an eligible legitimate queued payout. Preserve old receipts and use a fresh run journal.
- [ ] Reliability: bounded read retries with backoff/jitter, visible stale data, no automatic retry of ambiguous writes; check replay, caps, reserves and pause behavior.
- [ ] Product: align site, README and deck around a treasury team using a relay; explain V3 execution and provide an integration example. Treat paid monitoring as a business hypothesis.
- [ ] Organizer clarification: prepare questions on mainnet V3 requirements, cross-chain track fit and presentation format. User sends the message.
- [ ] Final materials: update evidence, <=3-minute video, PDF and submission fields; check public links without login; rehearse and keep a recorded fallback.

## Working schedule

Nov 1 baseline and questions; Nov 2–3 guardian and testnet; Nov 4 reliability/docs; Nov 5 materials, rehearsal and submission. Verify the latest official deadline before submitting.

## Progress log

- Nov 1: inspected the published source package (`airlock-push`); baseline tests started. Existing demo preflight already reserves peak pause storage, but signing preflight used only net storage. Fix and regression coverage in progress.
- Nov 1: corrected signing affordability to include peak storage; added regression proving signing is blocked when only net deposit is affordable. Full suite: 22 checks passed. Public build and operator build passed.
- Nov 1: implemented a key-free terminal guardian observer with deadline/state alerts, capped read backoff and stale-state failure output. Browser notification UI remains pending. Single-shot real check correctly failed closed when finalized snapshot could not be obtained within 45 seconds.
- Nov 1: both EVM RPCs returned expected chain IDs. Direct V3 EVM observation at block 269009: vault 48.75 tPOT, paused, reserved 0; guardian 4.91908574072156, relay 2.6906124962319628; quarantine 120 seconds. Recorded in ignored `test-results/final-preflight.json`. This is not finalized evidence. Local console's slow finalized/history synchronization needs investigation before the new transaction run.
- Nov 1: prepared organizer questions in `docs/ORGANIZER-QUESTIONS.md`; not sent. Next: resolve slow snapshot/history synchronization, then add visible guardian notifications and prepare a fresh demo journal without overwriting Week 2 receipts.

## Completion evidence

### Funding constraint (user update Nov 1)

User cannot request additional testnet tokens. Do not make new funding a dependency for the remaining code, docs and presentation work.

Read-only audit: guardian native free 5.01908574072156 tPOT (EVM spendable view 4.91908574072156), reserved/frozen 0; relay EVM balance 2.6906124962319628; Sepolia owner's V3 balance 0. Resume dry run explicitly returns `StorageDepositNotEnoughFunds`, peak 11.5245 tPOT, net storage charge 0. Combining known operator balances would still not cover peak storage plus fees. The 48.75 tPOT treasury cannot be used through this paused contract to fund its own resume; it exposes no administrative withdrawal.

Proceed with observer/UI, local adversarial and timing tests, integration docs and final presentation using the existing real testnet receipts, clearly identifying local tests and recorded runs. Leave the fresh timely-response testnet scenario pending rather than manufacture evidence. Any future funding or reduced runtime deposit coefficients must be rechecked before attempting writes.

### Nov 1 continuation

- Finalized snapshot verified at block 269217: paused, vault 48.75, no incomplete history in the source-package console. Measured read took about 9.5 seconds including initial connection. Initial catch-up can be much slower on an old journal.
- Historical scanning now advances by at most four 500-block ranges per snapshot. It preserves a contiguous cursor and explicitly reports incomplete history. Observer refuses to report full health until catch-up completes.
- Added a separate `--final-run` journal and block-time timing assertion to the testnet scenario. Timing evidence is checked after cancellation to avoid preventing cleanup. This scenario has not been run yet.
- Full regression suite: 24 checks passed, including the expiry boundary and bounded history progress.
- Resume dry run failed before signing: guardian balance 4.91908574072156 tPOT, peak storage requirement 11.5245 tPOT (before fee/margin). More testnet funding is required before resume and the new scenario. Existing vault funds remain untouched. Guardian native funding address: `5HKTe2e7hXWUN6gfreN9dMGQ3TBjqeVbkMzFAFpCaxfvXnQZ`.
- Added `docs/INTEGRATION.md`: target user, source-to-destination integration, operator funding and pilot acceptance. Browser alerts, legitimate delayed-payout run and revised video remain pending.
- Confirmed that the EVM gateway can return a different hash for a native block lookup. Final timing evidence therefore uses the native finalized block's timestamp storage, and a job is not reported finalized until that timestamp has been recorded. Dedicated regression covers this sequencing; all three final-demo tests passed after the change.

Every completed item must name its test, receipt or artifact. New code alone does not establish a timely guardian response or mainnet compatibility. Preserve existing receipts; do not overwrite the Week 2 scenario.

## Delivery checkpoint

Source changes published as commit `1cf801d` under Makssay. Staged files were checked against locally configured secret values before commit. GitHub raw local scenario returned HTTP 200 and `status: passed`. Vercel production deployment `airlock-portaldot-31crsxipy-makssays-projects.vercel.app` completed successfully. Ordinary public-domain reachability and browser visual QA must be distinguished from successful deployment.

Public production domain timed out from the local network during the delivery check. GitHub evidence remains accessible; deployment success is not reported as a successful browser visit.

## Availability fix

Published https://makssay.github.io/AirLock/ from the gh-pages branch. Ordinary HTTPS checks returned 200 for the root, JS/CSS, logo, receipt JSON, architecture and a byte-identical PDF. The static viewer's fixed read-only RPC observation and browser CORS preflight passed. Full regression suite: 27 passing checks.

The ordinary Actions build was rejected by GitHub because of an account billing lock. Branch-based Pages deployment succeeded. Repeat publication through `npm run publish:pages` was exercised successfully. No billing, local DNS or security settings were changed. The Vercel deployment remains available through reachable edge routes.

Automatic approval review rejected a final command batch including repository Homepage metadata changes, without a detailed reason. The public Pages site was already deployed and verified. Homepage metadata is left unchanged; README provides the working public link.

## Final submission preparation

Prepared complete testnet fields with native/EVM hash labels, attribution clarification, a spoken presentation script and a separate final checklist. Corrected the historical Week 2 checklist to reflect the team-reported submission and supplied PASSED report. A further browser inspection attempt was stopped by automatic URL verification; browser visual, mobile interaction and video playback checks remain open. No organizer message or DoraHacks update was sent.

Published source commit `0eaf669`; Vercel production `airlock-portaldot-p2s6hfvov-makssays-projects.vercel.app` and Pages static commit `b643582` contain the updated viewer. Ordinary Pages HTTPS checks passed for the new app chunk, root, PDF and receipts. Vercel new root and app chunk passed reachable-edge diagnostics with normal TLS. PDF hash matches its source. YouTube oEmbed returned 200 and the expected demo title; playback was not reverified. All four recorded demo states were checked for expected finalized message status. Local verification records are in ignored `test-results/submission-consistency.json` and `test-results/final-delivery-verification.json`.

## Ordered product improvements (Nov 1)

1. Telegram and independent background observation: implemented with persistent delivery, reminders and outage/recovery events; unit/integration checks in progress. Real chat delivery awaits notification credentials; hosting is a separate deployment.
2. Guardian readiness: expose connection freshness and action-specific fee/peak-deposit affordability before an incident. Existing signing preflight remains authoritative.
3. Explain queued payouts: record the policy context at submission, distinguish historical queue reason from present execution blockers, and explain legitimate delayed execution.
4. Cross-chain recovery: reconcile saved source/destination transaction hashes after interruption and explicitly resume the same validated source event without generating a replacement source request.
5. Demonstration: present both a stopped request and a legitimate delayed payout, preserving explicit local vs V3 evidence labels.

Complete in this order; do not treat code-only Telegram support as verified delivery or continuous hosting.

### Guardian improvements checkpoint

Telegram token and private chat ID remain only in the original ignored `.env`. Bot API test delivery succeeded (message 3). A standalone observer was started hidden on this Windows machine, with `AIRLOCK_NOTIFY_ENV` pointing to that file and its own delivery/history journals. An actual monitoring-unavailable message was delivered. Fresh complete V3 coverage was not yet verified; this is not a timely guardian-response test. The machine must remain awake.

Added read-only pause/resume readiness simulation, including native peak deposit, fee and margin, without loading a guardian key. Added current execution blockers and policy context to queued payout details, with explicit distinction from historical queue reasons. All 37 tests pass; operator build passes. Browser visual validation remains pending. Cross-chain recovery and the updated two-scenario demonstration remain the next stages.

Publication: source b11de60 pushed; Vercel production gqgn34v0a completed and original URL returned 200 through the reachable-edge diagnostic. Pages branch 73f2c86 built and ordinary HTTPS returned 200. Optimized initial observer history seeding from the existing local console cache; the observer still verifies identity and scans the remaining contiguous history. Updated operator console started separately on loopback port 5176 without moving signing secrets.

### Cross-chain recovery implementation

Implemented the fourth product stage: inspect and explicitly resume a saved cross-chain request in the operator console. The source event is revalidated and the original nonce reused. Destination hash/receipt, canonical block, transaction arguments and finalized message state are reconciled first. Unknown hashes or tip-only messages never permit replacement. Existing messages resolve the operation without sending again; finalized reverted submissions retain their previous hashes when explicitly retried. Guardian pause remains available during a pending relay.

Added 11 recovery tests covering source checks, reorgs, ambiguity, destination state, idempotency, pause and decoding the signed destination transaction. No source key is needed to inspect or continue an existing event; only the configured relay key is needed to submit on V3. The clean checkout remains read-only without signing credentials.

A read-only inspection of the historical source hash returned no receipt from the configured Sepolia RPC and remained waiting. No new public-testnet recovery transaction was sent. Two-scenario presentation is the remaining product stage; existing Anvil receipts and historical V3 receipts must keep their environment labels.

Validation checkpoint: full suite 48/48 passing, operator and public builds pass. The independent Telegram observer caught up and reported healthy finalized V3 block 280594 at 17:51:16 UTC; its persisted recovery notification delivery timestamp is 17:46:28 UTC. This establishes read-only observation recovery, not a new payout/guardian timing run.

Recovery delivery: source commit da48075 pushed; Vercel production ihtohukzy completed, with the updated public bundle verified through the original domain using the reachable-edge TLS diagnostic. Pages commit de90f69 built; its updated public bundle was verified over ordinary HTTPS. Local operator port 5176 was restarted with the new recovery route; missing control token returned 403. Browser interaction validation remains separate from these checks.

### Two-scenario demonstration

The final planned product stage now includes an updated interactive walkthrough: four historical V3 protection steps and three local Anvil legitimate-payment steps. The local generator captures contract state and balance at each operation block; the early read-only execution must return TooEarly specifically. Evidence projection checks network identity, statuses, eligibility timing and exact balance/reservation deltas. The viewer never signs and does not present the early check as a transaction.

Re-ran the local scenario: 9 assertions passed, 110-second pause margin. Full suite: 53 checks passed, including five new evidence/rendering checks. Operator build passed. Both narration scripts and the runbook were updated; the existing YouTube upload remains unchanged. No browser-controlled visual/interaction check was performed because the browser tool is unavailable; server rendering verifies evidence labels only.

Two-scenario delivery: source cd47414 published. Vercel production pqbd41oj2 completed; original-domain bundle and exact local evidence verified using the reachable-edge TLS diagnostic. Pages branch 6ad8926 built; updated bundle and exact local evidence verified over ordinary HTTPS. Both local evidence endpoints returned 200 and projected four V3 steps plus three local steps. Delivery details are retained in ignored test-results/two-scenario-publication.json. Browser interaction QA and a new video recording remain separate; the published YouTube upload was not changed.

### Try Airlock playground

User requested a visitor-operated treasury scenario with virtual funds and real Telegram. Implemented the simulation UI, fixed policy scenarios, session isolation, five-minute one-time pairing, webhook validation, cloud D1 persistence, CAS/idempotency and a leased outbox. Full suite: 66 passing tests. Vercel encrypted production configuration contains only sandbox service credentials; the private Worker contains notification credentials, never wallet keys.

An automatic review rejected the proposed local service/public tunnel command with no specific explanation. That command was not run. Switched to an owner-private Sites backend and kept the current Vercel frontend. Starter directory copying and the Sites archive helper failed on Windows; repaired missing starter folders with file copies, retained the helper's pushed source commit and validated a native tar archive of the matching build. Backend source 4ce154ee8ca6ab4d077e9fc61e694ca2bde2db84 deployed successfully as appgdep_6ae788d2d73081918665b234b5336e97, env revision 1.

Public source debc050 deployed to Vercel 78yc8x3g6 and Pages branch 280ec24 (built). Both private cloud API and public Vercel proxy created a session, added 50 tokens and issued a pairing link. Telegram webhook configured to the Vercel endpoint. A user Start action was requested for live chat-cycle verification. The existing V3 observer remains independent.

Playground delivery checkpoint: Vercel production 78yc8x3g6 and Pages branch 280ec24 are published. Updated lazy-loaded playground bundles were verified on both domains (Vercel through the reachable-edge TLS diagnostic, Pages over ordinary HTTPS). A separate unlinked public session passed all four scenarios through the deployed API with a real 20-second wait: oversized rejected, routine payout released, early execution rejected, legitimate payout released, suspicious request paused/cancelled. Final virtual balance 47.50, paid 2.50, reserved 0. This is simulation evidence, not a blockchain run. The bot webhook is installed; user-driven pairing/delivery acceptance remains pending Start. Browser visual/click QA remains unverified.

Added a five-minute, single-use Telegram-to-browser review handoff so phone users open the same treasury created on a computer. Fragment capabilities mint a separate session credential; the original browser remains authorized. Full suite: 68 passing tests, including same-treasury transfer, expiry and concurrent idempotent funding. Public and cloud builds pass.

Final playground handoff: source 5c1734b, Vercel production lud1al5ot and Pages branch f20e2f4 published. The updated bundles and public expired-handoff rejection were verified (Vercel reachable-edge diagnostic, Pages ordinary HTTPS). Private Worker source 9241eab9a5005c032077647cfe32a6afdd2ba6c7 deployed successfully as appgdep_6ae78deb34848191b5b0b4844a06ed0c, env revision 1. No local tunnel/service was used. The visitor-started Telegram pairing test has not yet been completed; use a newly generated site link because five-minute links expire. No browser visual/click verification was claimed.

Live visitor Telegram acceptance completed after a refreshed Start link. Public API exercise: suspicious 4-token request queued, paused and cancelled with zero payout; resume delayed 10 seconds; legitimate 2-token request queued, early execution rejected and execution accepted after the real 20-second demo wait. Telegram accepted seven notifications, all first-attempt deliveries. Final virtual balance 48, paid 2, reserved 0. Evidence: artifacts/playground-live-cycle.json. Earlier pending-Start notes are historical. Browser visual/click QA remains separate.
