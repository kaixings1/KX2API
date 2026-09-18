import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/__tests__/engine/task-decomposer-executor.test.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// mergeStrategy 的合法取值是 "sequential" | "parallel" | "merge"
// （见 src/engine/agent/task-decomposer.ts:57），**没有 "single"**。
// 实现在「降级为单任务」时把它设为 "merge"（第 110 行），这是既有且合理的行为；
// 本断言里的 'single' 属笔误。此处修正断言以匹配真实类型。
s = s.replace(
  '    expect(plan.mergeStrategy).toBe("single")',
  '    // 合法取值为 sequential | parallel | merge；单任务时设为 merge（见实现第 110 行）\n    expect(plan.mergeStrategy).toBe("merge")',
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('未命中断言')
}
