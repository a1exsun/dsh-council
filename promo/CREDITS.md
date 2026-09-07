# Credits and asset provenance

## Music

“Cipher” — Kevin MacLeod (incompetech.com).
Licensed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).

- [Official track and attribution](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100844)
- [Official MP3](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cipher2.mp3)
- ISRC: USUAN1100844. Published tempo: 150 BPM.
- The film uses an excerpt, shifts the audio by one frame (33.33 ms), reduces its volume, and fades both ends.
- At 30 fps, one beat is 12 frames and one 4/4 bar is 48 frames. An RMS onset check at 100 Hz found the strongest beat phase at 30 ms, within one analysis hop of the selected frame.
- This credit is also present on the film's end card and in both project READMEs.

## Typography

Inter, distributed under the SIL Open Font License. Original font and license are in `public/fonts/`.
Source: [Google Fonts / Inter](https://github.com/google/fonts/tree/main/ofl/inter).

## Motion references

- [Remotion template-overlay](https://github.com/remotion-dev/template-overlay): spring-based editorial card entrance and frame-driven transforms.
- [Remotion template-three](https://github.com/remotion-dev/template-three): `ThreeCanvas`, explicit lighting, and a deterministic 3D scene. The film's orbiting input cards and central decision sculpture are authored for DSH Council.

## Product footage

Recorded by operating the current local DeepSeek Harness Web UI in Chrome, using the actual installed Council command and configured providers. The browser's `Page.startScreencast` emitted JPEG frames with timestamps; `scripts/encode-recordings.mjs` preserves that timing and encodes 30 fps MP4 clips. Unchanged browser frames are held for their recorded duration. No UI replicas or fabricated model responses are used.

The source frames are local production intermediates under ignored `recordings/`. The encoded source clips in `public/footage/` are included so rendering does not depend on the local DSH server, its credentials, or another model invocation. Editing crops the page, changes the shot duration, and adds clearly separate editorial graphics. Waiting between model stages is omitted.

### Additional entry footage

Captured in a separate DSH `0.1.2-rc.1` Web instance loading only `@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`, and `dsh-council`, with the existing model configuration. The interface is the standard DSH UI. No model run was submitted.

| Clip | Duration | Action |
| :--- | ---: | :--- |
| `00-entry-command.mp4` | 9 s | Open a new conversation and type `/council`. |
| `00-entry-open.mp4` | 5 s | Activate the command and open Council's question card. |
| `00-entry-topic-navigation.mp4` | 6 s | Use the native question navigation to reach the topic field. |
| `00-entry-question.mp4` | 18 s | Type the crash-safe queue question. |

These clips are unedited source material in `public/footage/` and have not been added to the composition. Re-editing and the requested change to an arrangement of “Great Fairy's Fountain” are paused; no arrangement has been selected or downloaded.
