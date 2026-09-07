import {readdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

// CDP emits a frame when the real browser paints. Keep the timestamps and
// duplicate unchanged frames during encoding, preserving the recorded timing.
const root = resolve(import.meta.dirname, '..');
const selected = process.argv.slice(2);
for (const name of selected.length ? selected : await readdir(resolve(root, 'recordings'))) {
  if (!/^\d\d[a-z]?-/.test(name)) continue;
  const folder = resolve(root, 'recordings', name);
  const {seconds, frames} = JSON.parse(await readFile(resolve(folder, 'frames.json'), 'utf8'));
  if (!frames.length) throw new Error(`No captured frames in ${name}`);
  const first = frames[0].time;
  const lines = ['ffconcat version 1.0'];
  for (let i = 0; i < frames.length; i++) {
    const end = frames[i + 1]?.time ?? first + seconds;
    lines.push(`file '${frames[i].file}'`, `duration ${Math.max(0.001, end - frames[i].time).toFixed(6)}`);
  }
  lines.push(`file '${frames.at(-1).file}'`);
  const list = resolve(folder, 'capture.ffconcat');
  await writeFile(list, lines.join('\n'));
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list,
    '-t', String(seconds), '-vf', 'fps=30,scale=1600:900:flags=lanczos', '-c:v', 'libx264', '-preset', 'fast',
    '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', resolve(root, 'public/footage', `${name}.mp4`)], {stdio:'inherit'});
  console.log(`${name}: ${frames.length} browser paints, ${seconds}s`);
}
