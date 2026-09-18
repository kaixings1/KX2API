import { readFileSync, unlinkSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// 清理 tests/engine/legacy/ 下无用的 .d.ts 残留。
//
// 事实核查（决定能否删）：
//   1. 内容全部是「注释 + export {}」—— 零类型信息，删了不丢任何声明。
//   2. tsconfig.check.json 的 include 只覆盖 src/，根本不看 tests/ ——
//      它们不参与类型检查，也就无从干扰解析。
//   3. vitest 只收 src 下的 __tests__，node:test 只扫 tests/ 下的 .test.ts ——
//      没有任何工具会读这些 .d.ts。
//   4. 全仓库无按文件名引用它们的地方。
//
// 结论：纯文件垃圾，删除无风险。保留有实质内容的那一个。
const dir = 'tests/engine/legacy'

let removed = 0
const kept = []

for (const name of readdirSync(dir)) {
  if (!name.endsWith('.d.ts')) continue
  const full = join(dir, name)
  const txt = readFileSync(full, 'utf-8')
  const stripped = txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').trim()

  if (stripped !== '' && stripped !== 'export {};' && stripped !== 'export {}') {
    kept.push(name + '（有实质内容）')
    continue
  }

  unlinkSync(full)
  removed++
  console.log('已删除: ' + full)
}

console.log('\n--- 删除 ' + removed + ' 个；保留 ' + kept.length + ' 个 ---')
for (const k of kept) console.log('  保留: ' + k)
