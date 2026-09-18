import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const broken = 'tests/engine/legacy/broken'
const origin = 'src/engine/__tests__'

for (const name of readdirSync(broken)) {
  if (!name.endsWith('.ts')) continue
  const a = readFileSync(join(origin, name), 'utf-8').split(/\r?\n/)
  const b = readFileSync(join(broken, name), 'utf-8').split(/\r?\n/)
  const norm = s => s.replace(/(?:\.\.\/)+/g, '').trim()
  let substantive = 0
  const max = Math.max(a.length, b.length)
  for (let i = 0; i < max; i++) {
    if (norm(a[i] ?? '') !== norm(b[i] ?? '')) substantive++
  }
  console.log(`${name.padEnd(34)} 实质差异行数=${substantive}  ${substantive === 0 ? '（仅路径不同）' : '（有实质改动，需回填）'}`)
}
