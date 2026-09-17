import { readFileSync, writeFileSync } from 'node:fs'

// WorkflowStage 补了 'discuss' 之后，这些 Record<WorkflowStage, ...> 映射表必须齐全
// （它们是穷尽映射，TS2741 正是在提示「新增阶段没有对应处理」）。
// 讨论阶段由 team_leader 主持，符合其在 ROLE_META 中的职责（角色协调、结果整合）。
const edits = [
  {
    p: 'src/engine/orchestrator/taskGraph.ts',
    from: "    review: 'team_leader',\r\n    done: 'supervisor',",
    to: "    review: 'team_leader',\r\n    discuss: 'team_leader',\r\n    done: 'supervisor',",
  },
  {
    p: 'src/engine/orchestrator/taskGraph.ts',
    from: "    review: `[审查] 对所有阶段输出进行最终审查。`,\r\n    done: '[完成] 所有阶段已完成。',",
    to: "    review: `[审查] 对所有阶段输出进行最终审查。`,\r\n    discuss: `[讨论] 各角色就\"${task}\"的方案进行多轮讨论并达成共识。`,\r\n    done: '[完成] 所有阶段已完成。',",
  },
]

for (const e of edits) {
  let s = readFileSync(e.p, 'utf-8')
  const before = s
  let from = e.from
  let to = e.to
  if (!s.includes(from)) {
    from = from.replace(/\r\n/g, '\n')
    to = to.replace(/\r\n/g, '\n')
  }
  if (!s.includes(from)) {
    console.log('未命中: ' + JSON.stringify(e.from.slice(0, 40)))
    continue
  }
  s = s.replace(from, to)
  if (s !== before) {
    writeFileSync(e.p, s)
    console.log('已改: ' + e.p)
  }
}
