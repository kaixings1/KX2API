import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/orchestrator/pipeline.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 1) buildStagePrompt 的提示词表：补 discuss
const from1 = "      review: `## 最终审查阶段"
const idx1 = s.indexOf(from1)
if (idx1 < 0) {
  console.log('未命中 review 提示词')
  process.exit(1)
}

s = s.replace(
  "      done: ''," + NL + "      failed: '',",
  [
    "      discuss: `## 讨论阶段\\n\\n任务：${task}\\n\\n请各角色就方案进行多轮讨论：\\n1. 明确各自的关注点与约束\\n2. 指出方案中的分歧与风险\\n3. 收敛到可执行的共识（以 [CONSENSUS] 标记结论）`,",
    "      done: '',",
    "      failed: '',",
  ].join(NL),
)

// 2) stageToRole：补 discuss
s = s.replace(
  "    review: 'team_leader'," + NL + "    done: 'supervisor'," + NL + "    failed: 'supervisor',",
  [
    "    review: 'team_leader',",
    "    discuss: 'team_leader',",
    "    done: 'supervisor',",
    "    failed: 'supervisor',",
  ].join(NL),
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动')
}
