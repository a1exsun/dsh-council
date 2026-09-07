# Credits and asset provenance

## Music

**“The Legend of Zelda - Great Fairy Fountain (Chime Remix) [Dubstep]” — Chime.** Original composition by Koji Kondo; Zelda compositions and properties belong to Nintendo.

- [Official artist upload](https://www.youtube.com/watch?v=kQcTLwO064k).
- The film uses 00:00–01:34.8, with linear gain of 0.37 and fades at both ends.
- Chime's upload description invites YouTubers to use the remix in their videos. No broader synchronization license is represented here.
- The composer, remixer, and official source are credited on the film's end card.
- The standalone audio input, `public/audio/great-fairy-fountain-chime-preview.m4a`, is excluded from Git and is not distributed separately with this repository.

## Typography

[Inter](https://github.com/google/fonts/tree/main/ofl/inter), under the SIL Open Font License. The font and license are in `public/fonts/`.

## Motion references

- [Remotion template-overlay](https://github.com/remotion-dev/template-overlay): spring-driven floating cards.
- [Remotion template-three](https://github.com/remotion-dev/template-three): `ThreeCanvas` and frame-driven 3D animation. The orbiting cards and central sculpture were created for this film.

## Recordings

The footage was recorded by operating the installed Council plugin in DSH Web through Chrome. Browser paints were captured with timestamps and encoded to 30 fps MP4 with `scripts/encode-recordings.mjs`; unchanged frames retain their recorded duration. Source clips are in `public/footage/`.

The introductory footage uses a separate standard DSH `0.1.2-rc.1` instance with only the official base and Web bundles plus Council. Chapter 01 ends at `/council` input. Model selection and question entry follow in chapter 02.

The deliberation footage comes from a completed run comparing PostgreSQL leasing with a managed job queue. Both answers, both reviews, and arbitration completed successfully. The audit reports an average rank of 1.50 for each answer, with two votes each.

Chapter 04 displays the entire 1600 × 900 frame from `09-review.mp4`, including DSH navigation, execution trajectory, and the details pane. The final-answer and audit chapters retain the host's native text presentation. Editorial overlays are separate from the recorded UI; no model responses were fabricated.
