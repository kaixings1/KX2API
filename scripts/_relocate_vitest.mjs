import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'

/**
 * 把误放在 src/engine/__tests__/ 的 **vitest** 用例搬到 src/__tests__/engine/。
 *
 * 背景：
 *   - vitest.config.ts 的 exclude 明确排除了 `src/engine/__tests__/**`
 *     （注释：那里是「独立脚本，自己调用 process.exit」，用 npx tsx 手动跑）。
 *   - 但 coordinator.test.ts / task-decomposer-executor.test.ts 用的是
 *     vitest 的 describe/it/expect，却在被排除的目录里 → **从未被执行**。
 *   - `src/__tests__/engine/` 才是 vitest 用例的合法位置（已有多份同类用例）。
 *
 * 路径换算（精确替换，不做全局 `../` 改写以免误伤）：
 *   src/engine/__tests__/      →  src/__tests__/engine/
 *   '../agent/...'             →  '../../engine/agent/...'
 */
const moves = ['coordinator.test.ts', 'task-decomposer-executor.test.ts']

for (const name of moves) {
  const from = `src/engine/__tests__/${name}`
  const to = `src/__tests__/engine/${name}`

  if (!existsSync(from)) {
    console.log(`跳过（源不存在）: ${from}`)
    continue
  }
  if (existsSync(to)) {
    console.log(`跳过（目标已存在，避免覆盖）: ${to}`)
    continue
  }

  let s = readFileSync(from, 'utf-8')
  const before = s

  // 只改指向 engine 内部模块的相对导入
  s = s.replace(/(['"])\.\.\/(agent|core|commands|utils|services|streaming|errors|tools)\//g, "$1../../engine/$2/")
  // 处理 `from '../core.ts'` 这类无子目录的
  s = s.replace(/(['"])\.\.\/(core|index|transcript|stateMachine|tokenBudgetManager|messageNormalizer|requestBuilder|responseHandler|toolScheduler|autoCompactor|autoFixLoop|gitContext|toolNameResolver|loopConfig|compactCoordinator)\b/g, "$1../../engine/$2")

  writeFileSync(to, s)
  unlinkSync(from)
  const changed = s === before ? '（路径无需改动）' : '（已修正导入路径）'
  console.log(`已搬移: ${from} → ${to} ${changed}`)
}

// 清理同名的 .d.ts 编译残留（历史产物，无实际作用）
for (const name of moves) {
  const dts = `src/engine/__tests__/${name.replace(/\.ts$/, '.d.ts')}`
  if (existsSync(dts)) {
    unlinkSync(dts)
    console.log(`清理残留: ${dts}`)
  }
}
