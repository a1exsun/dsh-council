# DSH Council product film

https://github.com/user-attachments/assets/c643490c-1076-4abe-a832-e10f02eb5eda

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

## Persistent delivery

The finished film and poster are stored in Cloudflare R2 under the **Alex** account, in the dedicated `dsh-council-media` bucket. [`hosting.json`](hosting.json) records the account, public URLs, and verified SHA-256 digests. No credentials are stored in the repository.

GitHub sanitizes external `<video>` tags in repository Markdown. The READMEs therefore embed the identical file using GitHub's native video-attachment URL; `githubEmbedUrl` records this display copy. The R2 object remains the persistent original and is linked beside the player. Both URLs are stable; temporary GitHub CDN delivery tokens are never checked in. The video object is served as `video/mp4` with `Content-Disposition: inline` and supports HTTP byte ranges for seeking. The R2 URL is public and does not depend on an expiring signed token. The content hash in each object name allows immutable caching without serving stale video after a new release.

To republish these exact artifacts from the repository root using the authenticated Wrangler CLI:

```sh
export CLOUDFLARE_ACCOUNT_ID=b5ee1671e54d7c7fcf17e90b9ca7741a
npx --yes wrangler@4.129.0 r2 object put dsh-council-media/dsh-council-promo.2a531116217c.mp4 --remote --file docs/assets/dsh-council-promo.mp4 --content-type video/mp4 --content-disposition inline --cache-control 'public, max-age=31536000, immutable'
npx --yes wrangler@4.129.0 r2 object put dsh-council-media/demo-poster.2555be63de6c.jpg --remote --file docs/assets/demo-poster.jpg --content-type image/jpeg --content-disposition inline --cache-control 'public, max-age=31536000, immutable'
```

For a newly rendered version, compute new SHA-256 digests, use their first 12 characters in new object names, upload the same file as a new GitHub video attachment, and update `hosting.json` and the video URLs in the READMEs together. Do not overwrite different bytes under an immutable object name.

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
