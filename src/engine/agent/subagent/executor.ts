/**
 * src/engine/agent/subagent/executor.ts
 *
 * 子代理执行器 — 核心循环
 *
 * 职责：
 * 1. 根据 AgentDefinition 构建系统提示词
 * 2. 使用 K 的 client.ts 执行消息循环
 * 3. 追踪工具调用和 token 使用
 * 4. 返回 SubagentResult
 */

import type { AgentDefinition, SubagentContext, SubagentResult, Tool } from './types.ts'
import type { Message, ContentBlock } from '../../api/client.ts'
import { sendMessageStream, type ApiConfig } from '../../api/client.ts'

// ==================== 系统提示词构建 ====================

const BASE_SYSTEM_PROMPT = `你是 KX2Code 的子代理。用中文回复，完成任务后简要报告。调用者会将你的报告传达给用户。

你的优势：
- 在大型代码库中搜索代码、配置和模式
- 分析多个文件以理解系统架构
- 执行多步骤研究任务

指南：
- 对于文件搜索：当不知道某物位于何处时，进行广泛搜索。当你知道特定文件路径时，使用 Read。
- 对于分析：从广泛开始，然后缩小范围。如果第一个策略没有产生结果，请使用多种搜索策略。
- 要彻底：检查多个位置，考虑不同的命名约定，查找相关文件。
- 除非绝对必要，否则切勿创建文件。始终优先编辑现有文件而不是创建新文件。
- 除非明确要求，否则切勿主动创建文档文件（*.md）或 README 文件。`

/**
 * 为代理构建系统提示词
 */
export function buildAgentSystemPrompt(
  agent: AgentDefinition,
  cwd: string,
): string {
  const specificPrompt = agent.getSystemPrompt
    ? '(自定义提示词由 getSystemPrompt 提供)'
    : ''

  return `${BASE_SYSTEM_PROMPT}

## 代理类型：${agent.agentType}

${agent.whenToUse}

${specificPrompt}

## 工作目录
当前工作目录：${cwd}

## 工具限制
可用工具：${agent.tools?.[0] === '*' ? '所有' : (agent.tools?.join(', ') || '无')}
${agent.disallowedTools?.length ? `禁用工具：${agent.disallowedTools.join(', ')}` : ''}

## 执行要求
1. 专注于分配给你的任务范围
2. 完成后给出简洁报告
3. 使用中文回复`
}

// ==================== 子代理执行器 ====================

export interface ExecutorCallbacks {
  onProgress?: (toolUseId: string, data: { type: string; message?: unknown }) => void
  onToolUse?: (block: ContentBlock) => void
}

/**
 * 执行子代理
 */
export async function executeSubagent(
  agent: AgentDefinition,
  context: SubagentContext,
  callbacks?: ExecutorCallbacks,
): Promise<SubagentResult> {
  const startTime = Date.now()
  let toolUses = 0
  let tokensUsed = 0

  const systemPrompt = buildAgentSystemPrompt(agent, context.cwd)

  // 构建消息序列
  const messages: Message[] = context.isFork && context.parentMessages
    ? [...context.parentMessages, { role: 'user' as const, content: context.prompt }]
    : [{ role: 'user' as const, content: context.prompt }]

  // 简化执行：单次 API 调用（后续迭代可支持多轮工具调用）
  try {
    const result = await callLLM(context.config, systemPrompt, messages, context.availableTools, (block) => {
      if (block.type === 'tool_use') {
        toolUses++
        callbacks?.onToolUse?.(block)
      }
    })

    tokensUsed = estimateTokens(systemPrompt + context.prompt + result)

    return {
      success: true,
      output: result,
      tokensUsed,
      toolUses,
      durationMs: Date.now() - startTime,
    }
  } catch (error) {
    return {
      success: false,
      output: '',
      tokensUsed,
      toolUses,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * 调用 LLM
 */
async function callLLM(
  config: ApiConfig,
  systemPrompt: string,
  messages: Message[],
  tools: Tool[],
  onToolUse?: (block: ContentBlock) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = ''

    const toolDefs = tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters ?? { type: 'object', properties: {} },
      },
    }))

    sendMessageStream(
      { ...config, maxTokens: 4096 },
      [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        })),
      ],
      {
        onText: (chunk: string) => {
          output += chunk
        },
        onToolUse: (block: ContentBlock) => {
          onToolUse?.(block)
        },
        onDone: () => {
          resolve(output || '（子代理完成，无输出）')
        },
        onError: (err: string) => {
          reject(new Error(err))
        },
      },
    )
  })
}

/**
 * 粗略估算 token 数（字符数 / 4）
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
