import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const temporary = mkdtempSync(join(tmpdir(), 'dsh-council-host-'))
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: temporary, encoding: 'utf8', timeout: 240_000, ...options })
  if (result.error) throw new Error(`${result.error.message}\n${result.stdout}\n${result.stderr}`)
  assert.equal(result.status, 0, `${command} failed:\n${result.stdout}\n${result.stderr}`)
  return result.stdout
}
try {
  const [packed] = JSON.parse(run(npm, ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], { cwd: root }))
  assert(packed.files.some(file => file.path === 'lib/index.js'))
  assert(!packed.files.some(file => /(?:tests|scripts|node_modules)\//.test(file.path)))
  writeFileSync(join(temporary, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
  // Resolve the actual latest host on every smoke run, independent of the development lockfile.
  const version = execFileSync(npm, ['view', '@deepseek-ai/dsh@latest', 'version'], { encoding: 'utf8', timeout: 30_000 }).trim()
  process.stdout.write(`Testing packed plugin against DSH ${version}\n`)
  run(npm, ['install', '--no-audit', '--no-fund', `@deepseek-ai/dsh@${version}`, join(temporary, packed.filename)])
  copyFileSync(join(root, 'tests/fixtures/host.mjs'), join(temporary, 'host.mjs'))
  const documentedConfig = readFileSync(join(root, 'README.md'), 'utf8').match(/```yaml\n([\s\S]*?)\n```/)?.[1]
  assert(documentedConfig, 'README configuration example is missing')
  writeFileSync(join(temporary, 'smoke.patch.yml'), `- insert:\n    - id: dsh-council\n      name: dsh-council\n    - id: council-smoke\n      name: ${JSON.stringify(join(temporary, 'host.mjs'))}\n${documentedConfig}\n`)
  const bin = join(temporary, 'node_modules/@deepseek-ai/dsh/lib/bin.js')
  const environment = { ...process.env, DSH_HOME: join(temporary, 'home'), DSH_TELEMETRY_DISABLED: '1' }
  const output = run(process.execPath, [bin, '--profile', 'web', '--patch', join(temporary, 'smoke.patch.yml'), '--port', '0', '--no-open'], { env: environment, timeout: 60_000 })
  assert(output.includes('COUNCIL_HOST_OK'), output)
  const report = JSON.parse(readFileSync(join(temporary, 'report.json'), 'utf8'))
  assert.equal(report.calls, 8)
  assert.equal(report.guardChecks, 8)
  assert.deepEqual(report.locales, ['en', 'zh'])
  assert.equal(report.coldReloads, 2)
  process.stdout.write(`Host smoke passed: ${report.calls} real child model requests, ${report.guardChecks} denied out-of-scope tool calls, English + Chinese, persisted command results.\n`)
} finally {
  // Only this script's unique temporary directory is removed.
  rmSync(temporary, { recursive: true, force: true })
}
