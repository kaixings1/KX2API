import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/orchestrator/messages.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 'discuss' 是合法的编排阶段：OrchestratorConfig.mode 里已有 'discuss'（讨论模式），
// 讨论轮次产出的 AgentMessage.causeBy 也用它，但 WorkflowStage 漏了该成员，
// 导致 3 处 "Type '\"discuss\"' is not assignable to type 'WorkflowStage'"。
const re =
  /export type WorkflowStage =\r?\n  \| 'research'\r?\n  \| 'analyze'\r?\n  \| 'design'\r?\n  \| 'plan'\r?\n  \| 'implement'\r?\n  \| 'verify'\r?\n  \| 'review'\r?\n  \| 'done'\r?\n  \| 'failed'/

if (!re.test(s)) {
  console.log('未命中 WorkflowStage')
  process.exit(1)
}

s = s.replace(
  re,
  [
    'export type WorkflowStage =',
    "  | 'research'",
    "  | 'analyze'",
    "  | 'design'",
    "  | 'plan'",
    "  | 'implement'",
    "  | 'verify'",
    "  | 'review'",
    "  /** 多角色讨论（对应 OrchestratorConfig.mode === 'discuss'） */",
    "  | 'discuss'",
    "  | 'done'",
    "  | 'failed'",
  ].join(NL),
)

writeFileSync(p, s)
console.log('已改: ' + p)
