# DSH Council product film

https://github.com/user-attachments/assets/e81dfa36-5d93-4efb-8c67-015a5e4d2179

English product film made with real DSH recordings and Remotion graphics. **1920 × 1080 · 30 fps · 2,844 frames · 94.8 seconds.** Music: **Great Fairy Fountain (Chime Remix)**. No voiceover.

## Render

Requires Node.js 22.19+ or 24+ and npm. Source recordings and the Inter font are in `public/`. Obtain the music from the [official artist source](https://www.youtube.com/watch?v=kQcTLwO064k) and place the audio input at `public/audio/great-fairy-fountain-chime-preview.m4a`; the standalone recording is not distributed with this repository. See [CREDITS.md](CREDITS.md).

From this directory:

```sh
npm ci
npm run dev -- --port=3100
npm run lint
npm run render
npm run still
```

The renderer uses ANGLE for Three.js. Remotion may download Chrome Headless Shell on the first render. Rendering needs no running DSH server or model credentials.

Outputs: `../docs/assets/dsh-council-promo.mp4` and `../docs/assets/demo-poster.jpg`. Use `npm run render:review` for a local review file under `out/`.

## Chapters

| Start | Section | Content |
| :--- | :--- | :--- |
| 00:00.0 | Opening | 3D introduction |
| 00:06.4 | 01 — Start with /council | Standard DSH: new conversation and command entry |
| 00:11.6 | 02 — Choose your council | Answerers, reviewers, arbiter, and question |
| 00:27.6 | 03 — Start independently | Both answerer child sessions |
| 00:40.4 | 04 — Review the ideas | Full DSH viewport from `09-review.mp4`, including the trajectory and details pane |
| 00:56.4 | 05 — Reach a reasoned decision | Final recommendation |
| 01:12.4 | 06 — Inspect the reasoning | Identity mapping, rankings, consensus, and blind spots |
| 01:25.2 | Closing | Command, repository address, and music attribution |

Chapter cards and overlays use frame-driven animation. Recordings are trimmed and framed for readability; chapter 04 preserves the entire source viewport. Model waiting time is omitted.

## Hosting

The approved film is stored in **Alex's Cloudflare R2 account**, in `dsh-council-media`. [hosting.json](hosting.json) records the public URLs and SHA-256 digests. GitHub READMEs use an identical video attachment for native inline playback.

The R2 MP4 is served as `video/mp4` with `Content-Disposition: inline` and byte-range support. Its content-addressed URL is public and does not expire. The poster is stored alongside it. No credentials or temporary delivery tokens are checked in.

To upload the current approved film from the repository root:

```sh
CLOUDFLARE_ACCOUNT_ID=b5ee1671e54d7c7fcf17e90b9ca7741a npx --yes wrangler@4.129.0 r2 object put dsh-council-media/dsh-council-promo.49850b72ea14.mp4 --remote --file docs/assets/dsh-council-promo.mp4 --content-type video/mp4 --content-disposition inline --cache-control 'public, max-age=31536000, immutable'
```

For a changed film, use a new object name containing the first 12 characters of its SHA-256 digest, upload an identical GitHub attachment, and update `hosting.json` and the README embeds together. Keep different bytes under different immutable object names.

## Source files

- `src/Film.tsx` — timeline, recording frames, chapter cards, and audio mix.
- `src/Overlay.tsx` — floating explanatory cards.
- `src/Scene3D.tsx` — lighting, orbiting cards, and decision geometry.
- `CREDITS.md` — attribution and recording provenance.
- `scripts/encode-recordings.mjs` — converts timestamped browser captures to MP4; accepts optional clip names.

Local capture intermediates are in ignored `recordings/`. The encoded clips in `public/footage/` are sufficient to reproduce the picture edit.
