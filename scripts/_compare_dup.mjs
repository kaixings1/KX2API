import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// 逐个核对 tests/engine/legacy/broken/*.ts 是否与 src/engine/__tests__/ 同名文件重复
const broken = 'tests/engine/legacy/broken'
const origin = 'src/engine/__tests__'

for (const name of readdirSync(broken)) {
  if (!name.endsWith('.ts')) continue
  const a = join(origin, name)
  const b = join(broken, name)
  if (!existsSync(a)) {
    console.log(`${name.padEnd(34)} 原件不存在（→ 是独有文件，需保留）`)
    continue
  }
  const ta = readFileSync(a, 'utf-8')
  const tb = readFileSync(b, 'utf-8')
  // 归一化掉导入路径差异后再比：把 ../../../../src/ 与 ../ 两种前缀视为等价
  const norm = x => x.replace(/from\s+['"](?:\.\.\/)+/g, "from '")
  const same = norm(ta) === norm(tb)
  console.log(`${name.padEnd(34)} ${same ? '重复（仅路径不同）→ 可删副本' : '内容不同 → 需人工核对'}`)
}
