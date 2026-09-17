import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/orchestrator/pipeline.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// stageToRole 的返回类型写成 string，但它的映射表全是 AgentRole 值，
// 调用方 buildAgentDefinition 要 AgentRole（TS2345）。
// 用 AgentRole 作为返回类型，既准确又能让调用点免于断言。
s = s.replace(
  'function stageToRole(stage: WorkflowStage): string {' + NL + '  const map: Record<WorkflowStage, string> = {',
  'function stageToRole(stage: WorkflowStage): AgentRole {' + NL + '  const map: Record<WorkflowStage, AgentRole> = {',
)

// 补 AgentRole 导入
if (!s.includes('AgentRole')) {
  s = s.replace(
    "import type { WorkflowStage, AgentMessage, OrchestrationResult, RoleExecutionResult, OrchestratorConfig } from './messages.ts'",
    "import type { WorkflowStage, AgentRole, AgentMessage, OrchestrationResult, RoleExecutionResult, OrchestratorConfig } from './messages.ts'",
  )
}

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动')
}
