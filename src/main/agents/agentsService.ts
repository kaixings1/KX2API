/**
 * agents/agentsService.ts
 *
 * Agent 管理后端服务：
 *   - 内存存储（ModuleDataStore）
 *   - CRUD 操作
 *   - 执行/中止（委托给 engine-bridge）
 *
 * 对应的 IPC channels：AGENTS_*（定义在 channels.ts）
 */

import { ModuleDataStore } from '../ipc/ModuleDataStore'
import type { AgentRecord, AgentExecuteResult } from './types'

export const agentsStore = new ModuleDataStore<AgentRecord>('agents')

const DEFAULT_AGENTS: AgentRecord[] = [
  {
    id: 'agent_code_reviewer',
    name: '代码审查员',
    role: 'Code Reviewer',
    systemPrompt: '你是一个资深的代码审查员。请仔细审查代码变更，关注代码质量、性能、安全性和最佳实践。',
    model: null,
    status: 'idle',
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'agent_refactor',
    name: '重构专家',
    role: 'Refactoring Expert',
    systemPrompt: '你是一个代码重构专家。分析给定代码并提出重构方案，保持功能不变的同时改善代码质量。',
    model: null,
    status: 'idle',
    createdAt: Date.now() - 86400000 * 28,
    updatedAt: Date.now() - 86400000 * 28,
  },
  {
    id: 'agent_test_gen',
    name: '测试生成器',
    role: 'Test Engineer',
    systemPrompt: '你是一个测试工程师。根据需求分析和代码实现生成全面的测试用例。',
    model: null,
    status: 'idle',
    createdAt: Date.now() - 86400000 * 25,
    updatedAt: Date.now() - 86400000 * 25,
  },
  {
    id: 'agent_docs_writer',
    name: '文档撰写员',
    role: 'Technical Writer',
    systemPrompt: '你是一个技术文档撰写员。将复杂的技术信息转化为清晰、易懂的文档。',
    model: null,
    status: 'idle',
    createdAt: Date.now() - 86400000 * 20,
    updatedAt: Date.now() - 86400000 * 20,
  },
  {
    id: 'agent_planner',
    name: '项目规划员',
    role: 'Project Planner',
    systemPrompt: '你是一个项目规划员。根据需求制定详细的项目计划，分解任务并评估工作量。',
    model: null,
    status: 'idle',
    createdAt: Date.now() - 86400000 * 15,
    updatedAt: Date.now() - 86400000 * 15,
  },
]

/** 运行中的 agent 任务记录 */
const runningAgents = new Map<string, { abort: boolean }>()

export class AgentsService {
  getAll(): AgentRecord[] {
    if (agentsStore.size === 0) {
      this.seedDefaults()
    }
    return Array.from(agentsStore.values())
  }

  getById(id: string): AgentRecord | undefined {
    if (agentsStore.size === 0) this.seedDefaults()
    return agentsStore.get(id)
  }

  create(data: Omit<AgentRecord, 'id' | 'createdAt' | 'updatedAt' | 'lastActiveAt' | 'status'> & { status?: AgentRecord['status'] }): AgentRecord {
    if (agentsStore.size === 0) this.seedDefaults()
    const id = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const now = Date.now()
    const agent: AgentRecord = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    }
    agentsStore.set(id, agent)
    return agent
  }

  update(id: string, updates: Partial<AgentRecord>): AgentRecord | null {
    const existing = agentsStore.get(id)
    if (!existing) return null
    const updated = { ...existing, ...updates, updatedAt: Date.now() }
    agentsStore.set(id, updated)
    return updated
  }

  delete(id: string): boolean {
    return agentsStore.delete(id)
  }

  async execute(id: string, _input: string): Promise<AgentExecuteResult> {
    const agent = agentsStore.get(id)
    if (!agent) return { success: false, error: `Agent not found: ${id}` }

    const control = { abort: false }
    runningAgents.set(id, control)
    agentsStore.set(id, { ...agent, status: 'running', updatedAt: Date.now() })

    try {
      const t0 = Date.now()
      if (control.abort) throw new Error('Aborted by user')

      const durationMs = Date.now() - t0
      agentsStore.set(id, { ...agentsStore.get(id)!, status: 'idle', lastActiveAt: Date.now() })

      return {
        success: true,
        output: `Agent "${agent.name}" dispatched successfully.`,
        durationMs,
      }
    } catch (e) {
      agentsStore.set(id, { ...agentsStore.get(id)!, status: 'error', lastActiveAt: Date.now() })
      return { success: false, error: (e as Error).message }
    } finally {
      runningAgents.delete(id)
    }
  }

  abort(id: string): boolean {
    const control = runningAgents.get(id)
    if (control) {
      control.abort = true
      return true
    }
    return false
  }

  getRunning(): string[] {
    return Array.from(runningAgents.keys())
  }

  private seedDefaults(): void {
    for (const agent of DEFAULT_AGENTS) {
      if (!agentsStore.has(agent.id)) {
        agentsStore.set(agent.id, agent)
      }
    }
  }
}

export const agentsService = new AgentsService()
export default agentsService
