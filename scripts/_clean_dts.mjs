import { readFileSync, unlinkSync, existsSync } from 'node:fs'

/**
 * 删除「编译残留空壳」.d.ts。
 *
 * 判据（三者同时满足才删）：
 *   1. 内容去掉注释后仅为 `export {}` 或空
 *   2. 存在同名 .ts（说明它只是编译副产物，不是唯一声明）
 *   3. 全仓库无任何文件按文件名引用它
 *
 * 注意：不做「删除所有 .d.ts」这种批量操作 —— 仓库里 196 个 .d.ts 是**手写类型声明**
 * （如 src/main/types/electron.d.ts 的模块增强），删了会直接破坏类型。
 */
const shells = [
  'src/main/__tests__/profiles.test.d.ts',
  'tests/engine/legacy/coordinator.test.d.ts',
  'tests/engine/legacy/e2e-all-profiles.test.d.ts',
  'tests/engine/legacy/e2e-chat.test.d.ts',
  'tests/engine/legacy/engine.test.d.ts',
  'tests/engine/legacy/integration.test.d.ts',
  'tests/engine/legacy/model.test.d.ts',
  'tests/engine/legacy/modelscope-auth.test.d.ts',
  'tests/engine/legacy/stepfun-direct.test.d.ts',
  'tests/engine/legacy/task-decomposer-executor.test.d.ts',
  'tests/engine/legacy/tools.test.d.ts',
]

let removed = 0
for (const f of shells) {
  if (!existsSync(f)) {
    console.log(`跳过（不存在）: ${f}`)
    continue
  }
  // 二次确认：内容确为空壳
  const txt = readFileSync(f, 'utf-8')
  const stripped = txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').trim()
  if (stripped !== '' && stripped !== 'export {};' && stripped !== 'export {}') {
    console.log(`跳过（非空壳，保留）: ${f}`)
    continue
  }
  // 二次确认：同名 .ts 存在（.d.ts 只是副产物）
  const base = f.replace(/\.d\.ts$/, '')
  if (!existsSync(base + '.ts')) {
    console.log(`跳过（无同名 .ts，可能是唯一声明）: ${f}`)
    continue
  }
  unlinkSync(f)
  removed++
  console.log(`已删除: ${f}`)
}

console.log(`\n--- 删除 ${removed}/${shells.length} 个空壳 .d.ts ---`)
