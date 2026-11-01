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

## Telegram observer (independent of the browser)

The standalone process reads finalized V3 state directly. It uses its own event-history journal, never signs, and does not require the operator console to be running. Keep the process and machine running; Vercel and GitHub Pages do not host this process.

1. Create a bot with @BotFather and start a private conversation with it. Add `TELEGRAM_BOT_TOKEN` and numeric `TELEGRAM_CHAT_ID` to the ignored `.env`. Use a private guardian chat initially.
2. Optionally set `AIRLOCK_REVIEW_URL` to a reachable HTTPS operator interface. Leave it empty when only the local console is available. The public showcase site has no signing controls. Do not expose the local signing server to the internet to make a link work.
3. Run `npm run guardian:telegram`. For a read-only check without sending Telegram messages: `npm run guardian:telegram -- --dry-run --once`.
4. A separate notification-only env file can be supplied via the process environment variable `AIRLOCK_NOTIFY_ENV`. It needs no wallet secrets. No tokens or chat IDs are logged.

Notifications cover newly observed queued requests, 60/15-second reminder stages, eligibility, pause/resume, tracked request release/cancellation, and monitoring interruption/recovery. Time remaining is measured at the verified chain block. Review and sign through the operator console; Telegram has no signing commands.

Persistent delivery state and an exclusive process lock live under ignored `deployments/telegram-*`. First startup backfills event history; incomplete history and chain time older than 90 seconds are reported unavailable. Old resolved requests are not announced on first startup. Failed deliveries remain queued with backoff and Telegram retry-after handling. Reminders are replaced when a request changes state. The process sends at most one message per poll. Delivery is at least once: an ambiguous timeout or a crash after Telegram accepts a message can cause a duplicate.

### Running after closing the terminal (Windows)

Run from the repository root in PowerShell:

```powershell
$observerRoot = (Get-Location).Path
$observerNode = (Get-Command node).Source
Start-Process -FilePath $observerNode -ArgumentList 'scripts/telegram-watch.mjs' -WorkingDirectory $observerRoot -WindowStyle Hidden -RedirectStandardOutput "$observerRoot/deployments/telegram.stdout.log" -RedirectStandardError "$observerRoot/deployments/telegram.stderr.log"
```

This survives terminal closure, but not machine shutdown/reboot. For continuous hosting, use a persistent machine and a process supervisor; this repository includes `ops/airlock-telegram.service` as a Linux systemd template. Provision only notification credentials on that host. Never provision treasury signing keys for monitoring.

Implementation tests use injected Telegram responses. Private-chat test delivery and an actual outage alert were verified on the development machine on Nov 1. Full request/reminder/outcome delivery and continuous hosting remain separate acceptance checks. New observer journals can reuse the local console history cache, then verify identity and catch up remaining blocks in their own journal.
