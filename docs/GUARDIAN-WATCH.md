# Local guardian observer

Run the console, then in a second terminal run:

```powershell
npm run dev
# Second terminal:
npm run guardian:watch
```

For a single health check: `npm run guardian:watch -- --once`.
Set `AIRLOCK_PORT` if the local console uses a different port.

The observer reads finalized snapshots from the local console. It prints JSON alerts with message ID, recipient, amount, eligibility time, remaining seconds and recommended review action. It alerts on first observation and state transitions, including already queued requests after a restart. It never reads signing keys, prints control tokens, signs transactions or sends messages to third-party services.

Keep the process running and its terminal visible. The control room also provides in-panel alerts and optional browser notifications after clicking Enable notifications. Keep that browser tab open. Background service installation and external delivery remain pending. Review and pause/cancel through the local console. Eligibility time is measured against the snapshot's chain timestamp; it is not a guarantee that a transaction submitted now will finalize before eligibility.

Unavailable snapshots produce `watch-unavailable`; do not treat earlier data as current. Read retries use capped exponential backoff and jitter. No transaction retries are performed. Missing event history must be resolved before relying on the observer for complete coverage.

## Fresh final scenario

After reviewing funding, resuming through the on-chain policy delay and completing history sync:

```powershell
node scripts/attack-demo.mjs --send-testnet --final-run
```

This is a transaction-sending command. It writes a separate `deployments/v3-final-demo.local.json` journal and `artifacts/v3-final-demo.json`, refuses to overwrite an existing journal, and checks the pause inclusion block timestamp against request eligibility after cancellation. Old Week 2 receipts remain intact. It records the earlier normal payout separately; it does not yet implement the additional legitimate delayed-payout scenario.
