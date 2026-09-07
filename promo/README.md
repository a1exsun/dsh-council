# DSH Council product film

[Watch the finished film](../docs/assets/dsh-council-promo.mp4).

English promotional film built in Remotion from actual Chrome recordings of the local DeepSeek Harness Council plugin. 1920 × 1080, 30 fps, 2,688 frames, 89.6 seconds. No voiceover. The music is **Cipher** by Kevin MacLeod, at 150 BPM; cuts, chapter shutters, and overlay entrances align to its 12-frame beat grid.

## Reproduce

Requires Node.js 22.19+ or 24+ and npm. From this directory:

```sh
npm ci
npm run dev -- --port=3100
npm run lint
npm run render
npm run still
```

The renderer uses ANGLE for the actual Three.js scenes. Source MP4 clips, music, and the Inter font are checked in under `public/`; rendering needs no running DSH server or model credentials. Remotion may download its Chrome Headless Shell on the first render.

Output: `../docs/assets/dsh-council-promo.mp4` and `../docs/assets/demo-poster.jpg`.

## Chapters

| Time | Section | Actual footage |
| :--- | :--- | :--- |
| 00:00.0 | Opening | Original Three.js sculpture of independent inputs around a central decision |
| 00:06.4 | 01 — Choose your council | Answerer and reviewer checkboxes, arbiter selection, topic entry |
| 00:22.4 | 02 — Start independently | Both completed answerer child sessions |
| 00:35.2 | 03 — Review the ideas | Native trajectory inspector, anonymous evaluations and ranking |
| 00:51.2 | 04 — Reach a reasoned decision | The actual final command result, with a clearly separate editorial summary |
| 01:07.2 | 05 — Inspect the reasoning | Real identity mapping, aggregate ranking, consensus, and blind spots |
| 01:20.0 | Closing | `/council`, repository address, music attribution |

Each chapter starts with a full-screen title and ends with a beat-aligned shutter. The source footage is trimmed and cropped; model waiting time is omitted. The command-result clips retain the host's native raw-text presentation. Overlays summarize the product or the recorded result, and do not impersonate app UI.

## Recorded run

Captured on 2026-09-07 in the local DSH Web instance. The topic compares crash-safe PostgreSQL leasing with a managed queue for three workers.

- Answerers: DeepSeek V4 Flash and DeepSeek V4 Pro.
- Reviewers: DeepSeek V4 Pro and GPT-6 Astra.
- Arbiter: DeepSeek V4 Pro.
- Outcome: both answers and both reviews completed, followed by a successful arbitration. The run's audit reports no failures; both answers averaged rank 1.50 from two reviews.
- The local blank session contained older failed/canceled command entries. Those are outside the film's crop; no existing records were deleted or rewritten.

Encoded clips are in `public/footage/`. Local capture intermediates live in ignored `recordings/`. When those intermediates are available, `node scripts/encode-recordings.mjs` converts the browser's timestamped JPEG paints into constant-frame-rate MP4, holding unchanged frames for their original duration. `recordings/decision.md` contains the result exported from the visible command output during production.

## Files

- `src/Film.tsx` — editorial timeline, live-footage framing, full-screen chapter shutters, and audio mix.
- `src/Overlay.tsx` — spring-driven floating explanatory cards, inspired by the official overlay template.
- `src/Scene3D.tsx` — deterministic ThreeCanvas scene, lighting, orbiting input cards, and decision geometry.
- `CREDITS.md` — music license, font license, motion references, and recording provenance.

Music: “Cipher” Kevin MacLeod (incompetech.com), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Excerpt edited, volume reduced, phase shifted, and faded. See the [official track](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100844).
