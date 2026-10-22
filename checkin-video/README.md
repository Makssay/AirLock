# Airlock Week 2 video

1920x1080, 15 fps, approximately 2 minutes 23 seconds, English synthetic narration (Gemini Flash TTS / Fenrir via OpenRouter). The eight-scene composition uses screenshots captured from the actual recorded-evidence walkthrough and the architecture SVG. It does not simulate new transactions or imply a live recording of signing.

## Reproduce on Windows

From this project directory: `npm ci`.

From the repository root: `node checkin-video/narrate-openrouter.mjs --generate`. The key is read from the ignored local `.env` (`OPENROUTER_API_KEY` or `OPENROUTER`). Speech is cached by script hash to prevent accidental regeneration. Billing receipts, when available, remain in ignored `out/fenrir-narration.json`. The Windows speech script is retained only as a legacy fallback.

Return to this directory and run:

```powershell
npx remotion studio --no-open
npx remotion render src/index.ts AirlockWeek2 ../docs/check-in/airlock-week2.mp4 --codec=h264 --crf=19 --concurrency=2 --port=3002
```

Narration text, screenshot references, scene start frames and durations are in `public/scenes.json`. Each scene includes 0.8 seconds of padding after its recorded narration. The OpenRouter narration script computes durations from the generated PCM audio before rendering.

Output MP4 and generated WAV narration are local artifacts excluded from Git. The screenshot assets and SVG are included. There is no public URL or submission created by these commands.
