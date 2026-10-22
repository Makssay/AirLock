# Airlock Week 2 video

1920x1080, 15 fps, approximately 2 minutes 25 seconds, English synthetic narration (Microsoft Zira Desktop). The eight-scene composition uses screenshots captured from the actual recorded-evidence walkthrough and the architecture SVG. It does not simulate new transactions or imply a live recording of signing.

## Reproduce on Windows

From this project directory: `npm ci`.

From the repository root: `powershell -NoProfile -File checkin-video/narrate.ps1`.

Return to this directory and run:

```powershell
npx remotion studio --no-open
npx remotion render src/index.ts AirlockWeek2 ../docs/check-in/airlock-week2.mp4 --codec=h264 --crf=19 --concurrency=2 --port=3002
```

Narration text, screenshot references, scene start frames and durations are in `public/scenes.json`. Each scene includes 1.1 seconds of padding after its recorded narration. If the speech engine or speaking rate changes, recompute durations before rendering.

Output MP4 and generated WAV narration are local artifacts excluded from Git. The screenshot assets and SVG are included. There is no public URL or submission created by these commands.
