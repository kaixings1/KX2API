/**
 * Agent 执行引擎 — 真实流式执行
 *
 * 职责：
 * - 构建包含 systemPrompt 的完整 prompt
 * - 通过 engine-bridge 调用 AI 引擎
 * - 将引擎返回的响应以流式事件逐 chunk 推送
 */

import { getEngineInstance } from '../engine-bridge'
import type { AgentRecord, AgentExecutionEvent, AgentExecuteResult } from './types'

export class AgentExecutor {
  /**
   * 流式执行：返回 AsyncIterable，每次 yield 一个 chunk
   */
  async *execute(agent: AgentRecord, input: string): AsyncIterable<AgentExecutionEvent> {
    yield { type: 'start', agentId: agent.id, timestamp: Date.now() }

    try {
      const fullResponse = await this.runAgent(agent, input)

      for (const char of fullResponse) {
        yield { type: 'chunk', agentId: agent.id, content: char, timestamp: Date.now() }
      }

      yield { type: 'done', agentId: agent.id, output: fullResponse, timestamp: Date.now() }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      yield { type: 'error', agentId: agent.id, error: message, timestamp: Date.now() }
    }
  }

  /**
   * 单次执行：收集所有 chunk 后返回完整结果
   */
  async executeOnce(agent: AgentRecord, input: string): Promise<AgentExecuteResult> {
    let output = ''
    let success = true
    let errorMsg: string | undefined

    for await (const event of this.execute(agent, input)) {
      if (event.type === 'chunk' && event.content) {
        output += event.content
      } else if (event.type === 'error') {
        success = false
        errorMsg = event.error
      }
    }

    return { success, output, error: errorMsg }
  }

  /**
   * 实际调用 AI 引擎
   */
  private async runAgent(agent: AgentRecord, input: string): Promise<string> {
    const engine = getEngineInstance()
    if (!engine) {
      throw new Error('引擎未初始化')
    }

    const fullPrompt = this.buildPrompt(agent, input)
    const result = await engine.query(fullPrompt)

    const lastMsg = result.messages?.[result.messages.length - 1]
    const content = typeof lastMsg?.content === 'string' ? lastMsg.content : ''
    return content || '(无回复内容)'
  }

  /**
   * 构建完整 prompt：systemPrompt + user input
   */
  private buildPrompt(agent: AgentRecord, input: string): string {
    if (agent.systemPrompt) {
      return `【角色设定】${agent.systemPrompt}\n\n【用户输入】${input}`
    }
    return input
  }
}
