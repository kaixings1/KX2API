/**
 * src/engine/agent/subagent/definitions.ts
 *
 * 内置代理定义（从 D:\src\tools\AgentTool\builtInAgents.ts 移植）
 *
 * K 适配：
 * - 移除 D:\src 的 feature() / GrowthBook 门控
 * - 移除 coordinator / explorer / plan 等实验性代理
 * - 保留核心 6 个通用代理类型
 * - 使用 K 的 AgentDefinition 类型
 */

import type { AgentDefinition } from './types.ts'

/** 通用型代理 */
export const GENERAL_PURPOSE_AGENT: AgentDefinition = {
  agentType: 'general-purpose',
  whenToUse: '通用型智能体，用于研究复杂问题、搜索代码以及执行多步骤任务',
  tools: ['*'],
  source: 'built-in',
  baseDir: 'built-in',
  maxTurns: 100,
}

/** 代码审查代理 */
export const CODE_REVIEWER_AGENT: AgentDefinition = {
  agentType: 'code-reviewer',
  whenToUse: '代码审查代理，用于审查代码质量、发现潜在问题和改进建议',
  tools: ['read', 'grep', 'glob', 'search'],
  source: 'built-in',
  baseDir: 'built-in',
  maxTurns: 50,
  disallowedTools: ['write_file', 'edit', 'bash'],
}

/** 研究员代理 */
export const RESEARCHER_AGENT: AgentDefinition = {
  agentType: 'researcher',
  whenToUse: '研究型代理，用于深入调研技术问题、分析多个文件以理解系统',
  tools: ['read', 'grep', 'glob', 'search', 'web_search'],
  source: 'built-in',
  baseDir: 'built-in',
  maxTurns: 100,
}

/** 工程师代理 */
export const ENGINEER_AGENT: AgentDefinition = {
  agentType: 'engineer',
  whenToUse: '工程师代理，用于实现功能、重构代码和编写实现',
  tools: ['*'],
  source: 'built-in',
  baseDir: 'built-in',
  maxTurns: 150,
}

/** 架构师代理 */
export const ARCHITECT_AGENT: AgentDefinition = {
  agentType: 'architect',
  whenToUse: '架构师代理，用于设计系统架构和评估技术方案',
  tools: ['read', 'grep', 'glob', 'search'],
  source: 'built-in',
  baseDir: 'built-in',
  maxTurns: 50,
  disallowedTools: ['write_file', 'edit', 'bash'],
}

/** QA 代理 */
export const QA_AGENT: AgentDefinition = {
  agentType: 'qa',
  whenToUse: 'QA 代理，用于编写测试、执行测试和分析质量',
  tools: ['read', 'grep', 'glob', 'bash', 'write_file'],
  source: 'built-in',
  baseDir: 'built-in',
  maxTurns: 80,
}

/** 默认代理列表（K 精简版，去掉实验性代理） */
export const DEFAULT_BUILT_IN_AGENTS: AgentDefinition[] = [
  GENERAL_PURPOSE_AGENT,
  CODE_REVIEWER_AGENT,
  RESEARCHER_AGENT,
  ENGINEER_AGENT,
  ARCHITECT_AGENT,
  QA_AGENT,
]

/** 根据类型查找代理 */
export function findAgentByType(agents: AgentDefinition[], type: string): AgentDefinition | undefined {
  return agents.find((a) => a.agentType.toLowerCase() === type.toLowerCase())
}
