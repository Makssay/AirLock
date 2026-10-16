# Airlock operator interface

Audience: developers and guardians reviewing cross-chain withdrawal requests. Primary task: see what was released, what is delayed, and cancel a suspicious release.

Palette: deep navy #182b49 for navigation, ice #f1f5fa for canvas, white #ffffff for work surfaces, cobalt #315ee8 for actions, amber #a76008 for quarantine, red #b73d4a for rejected/cancelled operations, teal #147567 for completed operations. Semantic color is always paired with text.

Type: system sans stack for controls and body, Georgia for the short product statement, monospace only for hashes and addresses. Base 16px; operator data 14px minimum.

Layout: left navigation, broad workspace with a release-path diagram as the visual anchor, horizontal budget strip, transaction ledger beside contextual request details. On mobile navigation becomes a compact header and the ledger becomes a stacked list.

The initial skill suggestion was a dark green operations dashboard. Revised to a bright work surface and navy shell to avoid the generic terminal aesthetic and keep security decisions readable. No decorative charts, neon effects or animated telemetry. All displayed amounts originate in the WASM host state or chain receipt.

Local mode is labelled “WASM lab”; the receipt names its evidence source. Advancing time changes only the isolated lab clock. Portaldot deployment is a separate explicit command with chain identity checks. Read-only mainnet probing never implies a testnet deployment.
