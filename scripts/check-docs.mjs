import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
for (const file of ['README.md', 'README.zh.md', 'CONTRIBUTING.md', 'SECURITY.md', 'docs/release-readiness.md']) {
  const path = resolve(root, file)
  const source = readFileSync(path, 'utf8')
  const withoutCode = source.replace(/```[\s\S]*?```/g, '')
  const links = [...withoutCode.matchAll(/(?:href|src)="([^"]+)"|\]\(([^)]+)\)/g)]
  for (const match of links) {
    const target = match[1] ?? match[2]
    if (/^(?:https?:|#)/.test(target)) continue
    assert(existsSync(resolve(dirname(path), target.split('#')[0])), `${file}: broken link ${target}`)
  }
  assert(!source.includes('/Users/'), `${file}: contains a private machine path`)
}
for (const file of ['README.md', 'README.zh.md']) {
  const source = readFileSync(resolve(root, file), 'utf8')
  assert(source.includes('DEMO VIDEO'), `${file}: missing video replacement marker`)
  assert(source.includes('docs/assets/demo-placeholder.svg'), `${file}: missing video placeholder`)
  assert(source.includes(file === 'README.md' ? 'README.zh.md' : 'README.md'), `${file}: missing language switch`)
}
process.stdout.write('Documentation links and bilingual entry points passed.\n')
