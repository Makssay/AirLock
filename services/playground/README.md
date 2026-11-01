# Playground backend source

- `../../lib/playground-model.mjs`: educational treasury state transitions.
- `../../lib/playground-cloud.mjs`: bounded session state, pairing, idempotency, rate limits and delivery leases.
- `runtime.mjs`: D1 compare-and-swap commit loop and post-response Telegram delivery.
- `cloud-source/`: route, Worker entry and migration/schema snapshots from the deployed private Sites checkout.

These snapshots retain the Vinext starter's original relative imports. Install them in the matching starter paths when reproducing the cloud service; they are not additional Vercel routes. The deployed runtime's TypeScript file and this JavaScript runtime have the same logic, with local import paths adjusted for their respective checkout layouts.

See [setup and trust boundaries](../../docs/PLAYGROUND.md). Runtime credentials and visitor data are never committed.
