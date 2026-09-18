import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// 只比较「非 import 行」，判断副本是否含路径之外的实质修复
const broken = 'tests/engine/legacy/broken'
const origin = 'src/engine/__tests__'

const isImport = l => /^\s*import\s/.test(l) || /^\s*\}?\s*from\s+['"]/.test(l)

for (const name of readdirSync(broken)) {
  if (!name.endsWith('.ts')) continue
  const a = readFileSync(join(origin, name), 'utf-8').split(/\r?\n/).filter(l => !isImport(l))
  const b = readFileSync(join(broken, name), 'utf-8').split(/\r?\n/).filter(l => !isImport(l))

  const diffs = []
  const max = Math.max(a.length, b.length)
  for (let i = 0; i < max; i++) {
    const la = (a[i] ?? '').trim()
    const lb = (b[i] ?? '').trim()
    if (la !== lb) diffs.push({ i, la, lb })
  }
  console.log(`\n${name} — 非 import 行差异 ${diffs.length} 处`)
  for (const d of diffs.slice(0, 8)) {
    console.log(`  原件: ${d.la.slice(0, 110)}`)
    console.log(`  副本: ${d.lb.slice(0, 110)}`)
  }
}
