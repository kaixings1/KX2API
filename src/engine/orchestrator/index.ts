/**
 * engine/orchestrator/index.ts — 编排器统一导出
 */

export { Orchestrator, type OrchestratorDeps, DEFAULT_CONFIG } from './orchestrator.ts'
export { PipelineExecutor, type PipelineExecutorDeps, PIPELINE_STAGES } from './pipeline.ts'
export { TaskGraph, buildPipelineGraph, buildParallelGraph, type TaskNode } from './taskGraph.ts'
export {
  buildAgentDefinition,
  getAllRoles,
  getRoleDisplayName,
} from './agentRole.ts'
export type {
  AgentRole,
  AgentMessage,
  WorkflowStage,
  StepResult,
  RoleExecutionResult,
  OrchestrationResult,
  OrchestratorConfig,
  AgentDefinition,
  StageContext,
} from './messages.ts'
