import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/orchestrator/pipeline.ts'
let s = readFileSync(p, 'utf-8')
const before = s

s = s.replace(
  "import type { WorkflowStage, AgentMessage, OrchestrationResult, RoleExecutionResult, OrchestratorConfig } from './messages.ts'",
  "import type { WorkflowStage, AgentRole, AgentMessage, OrchestrationResult, RoleExecutionResult, OrchestratorConfig } from './messages.ts'",
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动（检查是否已导入）')
}
