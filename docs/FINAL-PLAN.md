# Airlock final delivery plan

Started 2026-11-01. Source: team plan and the supplied Oct 30 AMA notes.

## Latest status

Implemented and verified: peak-deposit signing preflight, bounded history catch-up, terminal guardian observer, stale-state write blocking, native finalized timestamps, 25 regression checks, and an isolated 9-assertion Anvil scenario with a 110-second pause margin. Public and operator builds pass. Live observer checked finalized V3 block 269431 with no queued requests.

Implemented pending browser validation: Guardian watch panel and opt-in browser notifications. Automatic Computer Use review could not establish the browser URL, so browser interactions were stopped. Queued and stale panel server-render checks passed; those are not browser visual checks.

Prepared: integration guide, final submission draft, presentation/Q&A runbook and organizer questions. Existing video/PDF retain the recorded testnet scenario; no new V3 timing evidence is claimed. External messages/submission were not sent.

Open: browser QA, fresh V3 timely-response and delayed-payout run (funding-constrained), hosted notifications, pilot, organizer mainnet/track clarification and final submission review.

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
