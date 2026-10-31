# Public Airlock viewer

Production: https://airlock-v3-by-makssay-and-kuznets.vercel.app

Vercel project: `airlock-portaldot`, scope `makssays-projects`.

## Build and deploy

Node.js 22+ and npm. Install with `npm ci`; build with `npm run build:public`. The tracked `vercel.json` selects this command and serves `dist/`. After linking the Vercel project, deploy with `vercel deploy --prod`.

The public viewer reuses the recorded four-stage walkthrough. Its receipts are copied from the reviewed artifacts at build time. The home page links the YouTube video, repository and architecture diagram. The local operator console remains available through `npm run dev`.

## Network observation

`GET /api/network` checks chain ID 420420777 and compares the deployed contract bytecode against a pinned SHA-256 digest. It reads balance at an explicit latest RPC block and returns observation time. Response caching is 30 seconds with up to 60 seconds stale while revalidating. This observation is separate from recorded finalized demo receipts.

Only fixed read methods and a fixed contract/RPC are used. POST returns 405. No generic RPC proxy, transaction submission or operator action endpoint is deployed. No SEED, PRIVATE, relay wallet or OpenRouter key is needed in hosting settings.

## Verification

All 19 regression checks and the public production build passed. Browser checks covered the four demo stages, embedded YouTube playback and a 375-pixel mobile viewport without horizontal overflow. The production root, evidence JSON, architecture and logo returned HTTP 200 without authentication; the live observer returned a bytecode-verified balance. Private-file paths and the local write endpoint returned 404. Network observer POST returned 405.

The original `airlock-portaldot.vercel.app` hostname resolved to Vercel edge IPs that timed out on the local network. The replacement `airlock-v3-by-makssay-and-kuznets.vercel.app` is registered as a production project domain and resolves to a reachable Vercel edge. It was verified through ordinary HTTPS requests and in the browser without authentication, IP overrides or changes to visitor settings. Deployment protection remains unchanged. Future production deployments automatically receive this domain.

## GitHub Pages availability mirror

https://makssay.github.io/AirLock/ is published from the `gh-pages` branch. Run `npm run publish:pages` to build the wallet-free public viewer locally with `AIRLOCK_BASE=/AirLock/`, push static files and request a Pages build. Asset and evidence links respect the project base path. Vercel still builds at `/` and retains its read-only API.

On GitHub Pages the network card makes fixed read-only calls directly to the configured V3 RPC, checks chain identity and bytecode SHA-256, and reads balance/code at one explicit block. It needs no backend or secrets. RPC failure leaves the recorded demo and evidence available. The RPC accepted the browser CORS preflight during verification.

The Vercel timeout was isolated to network routing to specific edge addresses: ordinary DNS selected an unreachable address, while the same hostname returned HTTP 200 through a reachable Vercel edge with normal TLS validation. No local DNS, hosts, proxy or security configuration was changed. A hosting mirror avoids relying on that edge route.

The ordinary Actions workflow could not start because GitHub reported an account billing lock. Pages branch deployment was selected instead; `.github/workflows/pages.yml` is available only for manual dispatch if ordinary Actions becomes available. No billing settings were changed. Local publication preserves PDF bytes and contains no operator endpoints or secrets.
