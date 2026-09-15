/**
 * Agent 执行引擎端口（port）
 */

import type { AgentRecord } from './types'
import type { AgentExecutionEvent, AgentExecuteResult } from './types'

export interface IAgentExecutor {
  execute(agent: AgentRecord, input: string): AsyncIterable<AgentExecutionEvent>
  executeOnce(agent: AgentRecord, input: string): Promise<AgentExecuteResult>
}
