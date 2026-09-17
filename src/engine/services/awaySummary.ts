/**
 * AwaySummary — KX2API 适配版
 *
 * 从 doge-desktop src/services/awaySummary.ts 移植
 * 用户长时间未交互后，基于最近对话自动生成 1-3 句会话摘要
 */

import { sendMessageStream, type Message, type ApiConfig } from '../../engine/api/client.ts'

export interface AwaySummaryConfig {
  provider: ApiConfig['provider']
  apiKey: string
  model: string
  baseUrl?: string
  maxTokens?: number
}

/** 生成「离开摘要」时纳入的最近消息条数（默认 30） */
export const DEFAULT_RECENT_MESSAGE_WINDOW = 30

let recentMessageWindow = DEFAULT_RECENT_MESSAGE_WINDOW

/**
 * 调整摘要窗口（设置界面改完即时生效）。
 * 该值决定摘要能看到多少上下文：窗口越大摘要越准，但消耗的 token 越多。
 */
export function setRecentMessageWindow(n?: number | void): void {
  if (typeof n === 'number' && Number.isFinite(n) && n > 0) {
    recentMessageWindow = Math.floor(n)
  }
}

/** 当前生效的摘要窗口 */
export function getRecentMessageWindow(): number {
  return recentMessageWindow
}

function buildAwaySummaryPrompt(memory: string | null): string {
  const memoryBlock = memory ? `会话记忆（更广泛的上下文）：\n${memory}\n\n` : ''
  return `${memoryBlock}用户暂时离开后返回。请写 1-3 句简短的话。首先说明高层级任务——他们正在构建或调试什么，而不是实现细节。接下来：下一步具体操作。跳过状态报告和提交回顾。`
}

/**
 * 生成会话摘要
 * @param messages 最近的消息历史
 * @param config API 配置
 * @param signal 可选的取消信号
 * @returns 摘要文本，失败返回 null
 */
export async function generateAwaySummary(
  messages: readonly Message[],
  config: AwaySummaryConfig,
  signal?: AbortSignal,
): Promise<string | null> {
  if (messages.length === 0) {
    return null
  }

  try {
    const recent = messages.slice(-recentMessageWindow)
    recent.push({
      role: 'user',
      content: buildAwaySummaryPrompt(null),
    })

    const apiMessages: Message[] = [
      { role: 'system', content: '你是 KX2Code 助手。请根据最近对话生成简短摘要。' },
      ...recent,
    ]

    let summary = ''
    await new Promise<void>((resolve, reject) => {
      sendMessageStream(
        {
          provider: config.provider,
          apiKey: config.apiKey,
          model: config.model,
          baseUrl: config.baseUrl,
          maxTokens: config.maxTokens || 256,
        },
        apiMessages,
        {
          onText: (chunk) => { summary += chunk },
          onToolUse: () => {},
          onDone: () => { resolve() },
          onError: (err) => { reject(new Error(err)) },
        },
        signal,
      )
    })

    const trimmed = summary.trim()
    return trimmed || null
  } catch (err) {
    if (signal?.aborted) {
      return null
    }
    console.error('[awaySummary] generation failed:', err)
    return null
  }
}
