import type { ToolCallingPlan } from './types.ts'
import { getToolProtocol } from './protocols/index.ts'
import { extractToolCallsFromText } from './toolCallExtractor.ts'

/**
 * 流式解析器状态：
 *  - PASS_THROUGH: 未检测到工具标记，直接透传 content
 *  - BUFFERING: 已检测到标记起始，正在收集完整工具调用块
 *  - EMITTED: 已发出工具调用，等待下一个内容段
 */
enum StreamState {
  PASS_THROUGH,
  BUFFERING,
  EMITTED,
}

export class ToolStreamParser {
  private readonly plan: ToolCallingPlan
  private buffer = ''
  private state: StreamState = StreamState.PASS_THROUGH
  private nextToolCallIndex = 0
  private releasedLength = 0
  private emittedToolCall = false

  constructor(plan: ToolCallingPlan) {
    this.plan = plan
  }

  push(content: string, baseChunk: any, includeRole: boolean = false): any[] {
    if (!content || !this.plan.shouldParseResponse) return []

    this.buffer += content
    const chunks: any[] = []

    switch (this.state) {
      case StreamState.PASS_THROUGH:
        return this.handlePassThrough(chunks, baseChunk, includeRole)
      case StreamState.BUFFERING:
        return this.handleBuffering(chunks, baseChunk, includeRole)
      case StreamState.EMITTED:
        return this.handleEmitted(chunks, baseChunk, includeRole)
    }
  }

  private handlePassThrough(chunks: any[], baseChunk: any, includeRole: boolean): any[] {
    const markerStart = findMarkerStart(this.buffer, this.plan)
    if (markerStart.matched) {
      // 标记完全匹配 → 切出前缀内容，进入 BUFFERING
      if (markerStart.index > 0) {
        chunks.push(createContentChunk(baseChunk, this.buffer.slice(0, markerStart.index), includeRole))
      }
      this.buffer = this.buffer.slice(markerStart.index)
      this.releasedLength = 0
      this.state = StreamState.BUFFERING
      return this.handleBuffering(chunks, baseChunk, includeRole)
    }

    if (markerStart.partial) {
      // 部分匹配 → 等待更多数据
      if (markerStart.index > 0) {
        chunks.push(createContentChunk(baseChunk, this.buffer.slice(0, markerStart.index), includeRole))
        this.buffer = this.buffer.slice(markerStart.index)
        this.releasedLength = 0
      }
      this.state = StreamState.BUFFERING
      return chunks
    }

    // 无标记 → 尝试兜底提取，或透传内容
    return this.tryFallbackOrRelease(chunks, baseChunk, includeRole)
  }

  private handleBuffering(chunks: any[], baseChunk: any, _includeRole: boolean): any[] {
    const parsed = parseBufferedToolCall(this.buffer, this.plan)
    if (parsed.toolCalls.length > 0) {
      return this.emitToolCalls(chunks, baseChunk, parsed.toolCalls)
    }

    // 无效工具名或部分匹配 → 重置，下次 push 重新检测
    if (parsed.invalidToolNames.length > 0 || parsed.rawMatches.length > 0) {
      this.reset()
    }

    return chunks
  }

  private handleEmitted(chunks: any[], baseChunk: any, includeRole: boolean): any[] {
    // EMITTED 状态下 buffer 已清空，新内容直接透传
    const newContent = this.buffer
    if (newContent) {
      chunks.push(createContentChunk(baseChunk, newContent, includeRole))
    }
    this.buffer = ''
    this.releasedLength = 0
    this.state = StreamState.PASS_THROUGH
    return chunks
  }

  private tryFallbackOrRelease(chunks: any[], baseChunk: any, includeRole: boolean): any[] {
    // 兜底纯文本提取：由 fallbackStrategy 控制是否启用
    if (this.plan.fallbackStrategy !== 'never') {
      const extracted = extractToolCallsFromText(stripSourceLines(this.buffer))
      if (extracted.toolCalls.length > 0) {
        return this.emitFallbackToolCalls(chunks, baseChunk, extracted.toolCalls, includeRole)
      }
    }

    // 仅释放新到达的内容片段
    const newContent = this.buffer.slice(this.releasedLength)
    if (newContent) {
      chunks.push(createContentChunk(baseChunk, newContent, includeRole))
    }
    this.releasedLength = this.buffer.length
    return chunks
  }

  private emitToolCalls(chunks: any[], baseChunk: any, toolCalls: any[]): any[] {
    for (const toolCall of toolCalls) {
      const indexedToolCall = {
        ...toolCall,
        index: this.nextToolCallIndex,
        id: toolCall.id || `call_${this.nextToolCallIndex}`,
      }
      this.nextToolCallIndex += 1
      chunks.push(createToolCallChunk(baseChunk, indexedToolCall, !this.emittedToolCall))
    }
    this.emittedToolCall = true
    this.buffer = ''
    this.releasedLength = 0
    this.state = StreamState.EMITTED
    return chunks
  }

  private emitFallbackToolCalls(chunks: any[], baseChunk: any, toolCalls: any[], includeRole: boolean): any[] {
    for (const toolCall of toolCalls) {
      const { confidence: _confidence, ...toolCallBase } = toolCall
      const indexedToolCall = {
        ...toolCallBase,
        index: this.nextToolCallIndex,
        id: toolCall.id || `call_${this.nextToolCallIndex}`,
      }
      this.nextToolCallIndex += 1
      this.emittedToolCall = true
      chunks.push(createToolCallChunk(baseChunk, indexedToolCall, includeRole && !this.emittedToolCall))
    }
    this.buffer = ''
    this.releasedLength = 0
    this.state = StreamState.EMITTED
    return chunks
  }

  private reset(): void {
    this.buffer = ''
    this.releasedLength = 0
    this.state = StreamState.PASS_THROUGH
  }

  flush(baseChunk: any): any[] {
    if (!this.buffer) {
      this.releasedLength = 0
      return []
    }

    const parsed = parseBufferedToolCall(this.buffer, this.plan)
    if (parsed.toolCalls.length > 0) {
      const chunks = parsed.toolCalls.map((toolCall) => {
        const indexedToolCall = {
          ...toolCall,
          index: this.nextToolCallIndex,
          id: toolCall.id || `call_${this.nextToolCallIndex}`,
        }
        this.nextToolCallIndex += 1
        this.emittedToolCall = true
        return createToolCallChunk(baseChunk, indexedToolCall, false)
      })
      this.reset()
      return chunks
    }

    // 兜底：协议解析器未找到结果，由 fallbackStrategy 控制是否尝试纯文本提取
    if (this.plan.fallbackStrategy !== 'never') {
      const extracted = extractToolCallsFromText(stripSourceLines(this.buffer))
      if (extracted.toolCalls.length > 0) {
        const chunks = extracted.toolCalls.map((toolCall) => {
          const indexedToolCall = {
            ...toolCall,
            index: this.nextToolCallIndex,
            id: toolCall.id || `call_${this.nextToolCallIndex}`,
          }
          this.nextToolCallIndex += 1
          this.emittedToolCall = true
          return createToolCallChunk(baseChunk, indexedToolCall, false)
        })
        this.reset()
        return chunks
      }
    }

    const shouldReleaseText = !this.emittedToolCall
    const text = shouldReleaseText ? this.buffer.slice(this.releasedLength) : ''
    this.reset()
    return text ? [createContentChunk(baseChunk, text, false)] : []
  }

  hasEmittedToolCall(): boolean {
    return this.emittedToolCall
  }

  isBuffering(): boolean {
    return this.state === StreamState.BUFFERING
  }
}

function parseBufferedToolCall(buffer: string, plan: ToolCallingPlan) {
  const selected = getToolProtocol(plan.protocol)
  return selected.parse(buffer, { tools: plan.tools, protocol: plan.protocol })
}

/**
 * 剥离"源码/注释行"：以 const/let/var（去前导空格）或 // /* 开头的行，
 * 其内容绝不可能是真实工具调用（如 `const regex = /<tool_call>.../;`）。
 * 在兜底纯文本提取前调用，避免讲解/源码里的 <tool_call> 被误提为工具。
 * 注意：仅用于兜底提取的"考量文本"，不影响正常内容下发。
 */
function stripSourceLines(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const t = line.replace(/^\s+/, '')
      if (/^(const|let|var)\s/.test(t)) return ''
      if (t.startsWith('//')) return ''
      if (t.startsWith('/*')) return ''
      return line
    })
    .join('\n')
}

function findMarkerStart(buffer: string, plan: ToolCallingPlan): { matched: boolean; partial: boolean; index: number } {
  const protocol = getToolProtocol(plan.protocol)
  const ranges = fencedRanges(buffer)

  // Pass 1: find earliest complete marker start anywhere in buffer
  for (let index = 0; index < buffer.length; index += 1) {
    if (isInsideRange(index, ranges)) continue

    const suffix = buffer.slice(index)
    const detection = protocol.detectStart(suffix)
    if (detection.matched && detection.markerStart === 0) {
      return { matched: true, partial: false, index }
    }
  }

  // Pass 2: only check the buffer's TAIL for a partial (incomplete) marker.
  // This prevents mid-content prefixes like <|KX2API|invoke from being
  // treated as partial markers, while still catching trailing incomplete
  // markers like <|KX2API|tool_calls (the last chunk that hasn't arrived yet).
  const tailStart = Math.max(0, buffer.length - 200)
  for (let index = buffer.length - 1; index >= tailStart; index -= 1) {
    if (isInsideRange(index, ranges)) continue

    const suffix = buffer.slice(index)
    const detection = protocol.detectStart(suffix)
    if (detection.partial && detection.markerStart === 0) {
      return { matched: false, partial: true, index }
    }
  }

  return { matched: false, partial: false, index: -1 }
}

function fencedRanges(content: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = []
  const pattern = /```[\s\S]*?```/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(content)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length })
  }

  return ranges
}

function isInsideRange(index: number, ranges: Array<{ start: number; end: number }>): boolean {
  return ranges.some((range) => index >= range.start && index < range.end)
}

function createContentChunk(baseChunk: any, content: string, includeRole: boolean): any {
  return {
    ...baseChunk,
    choices: [{
      index: 0,
      delta: {
        ...(includeRole ? { role: 'assistant' } : {}),
        content,
      },
      finish_reason: null,
    }],
  }
}

function createToolCallChunk(baseChunk: any, toolCall: any, includeRole: boolean): any {
  const { rawText, confidence: _confidence, ...openAiToolCall } = toolCall
  void rawText
  void _confidence

  return {
    ...baseChunk,
    choices: [{
      index: 0,
      delta: {
        ...(includeRole ? { role: 'assistant' } : {}),
        tool_calls: [openAiToolCall],
      },
      finish_reason: null,
    }],
  }
}
