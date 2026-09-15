/**
 * streamQueueDetector.ts — 队列式工具调用检测器
 *
 * 与现有 marker 触发式缓冲互补：始终维持滑动窗口队列，持续检查队头是否构成完整工具调用。
 * 若完整 → 以 OpenAI tool_calls chunk 形式发出并出队；
 * 若不完整 → 队头作为普通正文输出，后续继续累积。
 */

import { parseToolCalls, type ToolParseResult } from './toolParser/index'
import { ToolCall } from './types'

export interface QueuedChunk {
  type: 'text'
  content: string
}

export interface DetectedToolCall {
  type: 'tool_call'
  toolCalls: ToolCall[]
  /** 被消费掉的队列原文（用于日志/调试） */
  consumedText: string
}

export type StreamQueueResult =
  | { kind: 'text'; content: string }
  | { kind: 'tool_calls'; toolCalls: ToolCall[]; consumedText: string }
  | { kind: 'none' }

const MAX_QUEUE_BYTES = 64 * 1024

export class StreamQueueDetector {
  private queue: QueuedChunk[] = []
  private queueText = ''
  private toolCallIndex = 0

  /**
   * 写入新内容并立即尝试消费队列头部。
   * 返回一个或多个结果：
   *   - 若队头是完整工具调用 → 返回 tool_calls 结果（队列已出队）
   *   - 若队头不构成工具调用 → 返回 text 结果（队头已出队并入正文）
   *   - 若队列尚短不足以判断 → 返回 none（内容已入队，等待更多数据）
   */
  feed(newText: string): StreamQueueResult[] {
    const results: StreamQueueResult[] = []
    if (!newText) return results

    this.enqueue(newText)

    while (this.queue.length > 0) {
      const headText = this.getHeadText()
      const markerIdx = headText.indexOf('[function_calls]')

      // 如果有 tool marker，先 flush marker 前面的纯文本
      if (markerIdx > 0) {
        const beforeMarker = headText.substring(0, markerIdx)
        if (this.shouldFlushHead(beforeMarker)) {
          const flushed = this.dequeueUpTo(markerIdx)
          results.push({ kind: 'text', content: flushed })
          continue
        }
      }

      // 检查从 marker 开始的部分是否构成完整工具调用
      const checkText = markerIdx >= 0 ? headText.substring(markerIdx) : headText
      if (markerIdx >= 0 && this.looksLikeCompleteToolCall(checkText)) {
        const consumed = this.dequeueAll()
        const parsed = this.parseToolCallsFromText(consumed)
        if (parsed) {
          this.toolCallIndex++
          results.push({
            kind: 'tool_calls',
            toolCalls: parsed,
            consumedText: consumed,
          })
          continue
        }
        this.rollbackConsumed(consumed)
        break
      }

      if (this.shouldFlushHead(headText)) {
        const flushed = this.dequeueHead()
        results.push({ kind: 'text', content: flushed })
        continue
      }

      break
    }

    return results
  }

  /**
   * 流结束时刷新剩余队列：
   *   - 队头构成工具调用 → 发出 tool_calls
   *   - 否则全部作为普通正文输出
   */
  flush(): StreamQueueResult[] {
    const results: StreamQueueResult[] = []

    while (this.queue.length > 0) {
      const headText = this.getHeadText()
      if (this.looksLikeCompleteToolCall(headText)) {
        const consumed = this.dequeueAll()
        const parsed = this.parseToolCallsFromText(consumed)
        if (parsed) {
          this.toolCallIndex++
          results.push({
            kind: 'tool_calls',
            toolCalls: parsed,
            consumedText: consumed,
          })
          continue
        }
        // 解析失败，回滚：把内容重新放回队列
        this.rollbackConsumed(consumed)
        break
      }
      break
    }

    const remaining = this.dequeueAll()
    if (remaining.length > 0) {
      results.push({ kind: 'text', content: remaining })
    }

    return results
  }

  /**
   * 安全上限保护：队列过长时强制刷新队头
   */
  enforceMaxSize(): StreamQueueResult[] {
    const results: StreamQueueResult[] = []
    while (this.queue.length > 0 && this.queueText.length > MAX_QUEUE_BYTES) {
      const flushed = this.dequeueHead()
      results.push({ kind: 'text', content: flushed })
    }
    return results
  }

  reset(): void {
    this.queue = []
    this.queueText = ''
    this.toolCallIndex = 0
  }

  getQueueLength(): number {
    return this.queue.length
  }

  getQueueTextLength(): number {
    return this.queueText.length
  }

  private enqueue(text: string): void {
    this.queue.push({ type: 'text', content: text })
    this.queueText += text
  }

  private dequeueHead(): string {
    const head = this.queue.shift()!
    this.queueText = this.queueText.slice(head.content.length)
    return head.content
  }

  private dequeueAll(): string {
    const all = this.queue.map(c => c.content).join('')
    this.queue = []
    this.queueText = ''
    return all
  }

  /** 消费队列前 maxChars 个字符，返回消费掉的文本 */
  private dequeueUpTo(maxChars: number): string {
    let consumed = ''
    let remaining = maxChars
    while (this.queue.length > 0 && remaining > 0) {
      const head = this.queue[0]
      if (head.content.length <= remaining) {
        consumed += this.dequeueHead()
        remaining -= head.content.length
      } else {
        const part = head.content.substring(0, remaining)
        head.content = head.content.substring(remaining)
        consumed += part
        this.queueText = this.queueText.substring(part.length)
        remaining = 0
      }
    }
    return consumed
  }

  private rollbackConsumed(text: string): void {
    this.queue.push({ type: 'text', content: text })
    this.queueText += text
  }

  private getHeadText(): string {
    return this.queue.map(c => c.content).join('')
  }

  private looksLikeCompleteToolCall(text: string): boolean {
    if (!text || text.length < 8) return false

    const marker = '[function_calls]'
    if (text.includes(marker)) {
      if (text.includes('[/function_calls]')) return true
      if (text.endsWith(']')) return true
      return false
    }

    if (/\[call[:=]/.test(text)) {
      if (/\](?:[\s\S]*?)\[\/call\]/.test(text)) return true
      return false
    }

    const openTags = (text.match(/<tool_use>/g) || []).length
    const closeTags = (text.match(/<\/tool_use>/g) || []).length
    if (openTags > 0 && openTags === closeTags) return true

    const fnCount = (text.match(/<function\s*=/g) || []).length
    const paramCount = (text.match(/<parameter\s*=/g) || []).length
    if (fnCount > 0 && paramCount >= fnCount) return true

    const jsonObjCount = (text.match(/\{/g) || []).length
    if (jsonObjCount > 0 && text.includes('"tool_calls"')) {
      const closeCount = (text.match(/\}/g) || []).length
      if (closeCount >= jsonObjCount) return true
    }

    return false
  }

  private shouldFlushHead(headText: string): boolean {
    if (headText.length === 0) return false

    const toolSignals = [
      '[function_calls]',
      '[call:',
      '[call=',
      '<tool_use>',
      '<antml:function_calls>',
      '"tool_calls"',
    ]

    const lastNewline = Math.max(headText.lastIndexOf('\n'), headText.lastIndexOf('。'), headText.lastIndexOf('. '), headText.lastIndexOf('！'), headText.lastIndexOf('! '), headText.lastIndexOf('？'), headText.lastIndexOf('? '))
    const stableEnd = lastNewline > 0 && headText.length - lastNewline > 64

    if (stableEnd && toolSignals.some(s => s.startsWith(headText.trim().slice(-Math.min(s.length, 30))))) return false

    if (toolSignals.some(s => headText.includes(s))) return false

    if (headText.length > 128) return true

    return false
  }

  private parseToolCallsFromText(text: string): ToolCall[] | null {
    try {
      const result: ToolParseResult = parseToolCalls(text)
      if (!result || !result.toolCalls || result.toolCalls.length === 0) return null
      return result.toolCalls as ToolCall[]
    } catch {
      return null
    }
  }

  private stringifyArgs(args: Record<string, unknown>): string {
    try {
      const clean: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(args)) {
        if (typeof val === 'string') {
          clean[key] = val
        } else {
          clean[key] = val
        }
      }
      return JSON.stringify(clean)
    } catch {
      return JSON.stringify(args)
    }
  }
}
