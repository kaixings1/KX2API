/**
 * streamParser.ts — 流式文本解析器
 *
 * 职责：
 * 1. 从累积的流式文本中提取 reasoning_content（推理思考过程）
 * 2. 从累积的流式文本中提取正文 content
 * 3. 从累积的流式文本中提取 XML 格式工具调用块（<tool_use>...）
 *
 * 支持的 JSON SSE 格式：
 *   {"delta":{"role":"assistant","reasoning_content":"..."}}  → 推理
 *   {"delta":{"role":"assistant","content":"..."}}            → 正文
 * 正文中可能包含 XML tool_use 块：
 *   <tool_use><name>pwd</name><arguments>{...}</arguments></tool_use>
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ParsedTool {
  id: string
  name: string
  arguments: string
  rawText: string
}

export interface ParsedContent {
  reasoning: string
  content: string
  tools: ParsedTool[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * 从 SSE chunk 行中提取 delta JSON 对象的原始文本
 * 输入: 完整行如 `data: {"id":"...","choices":[{"delta":{"role":"assistant","content":"hi"}}]}`
 * 输出: delta 对象字符串 如 `{"role":"assistant","content":"hi"}`
 */
function extractDeltaObject(line: string): Record<string, unknown> | null {
  const match = line.match(/data:\s*(\{[\s\S]*\})/)
  if (!match) return null
  try {
    const outer = JSON.parse(match[1]) as Record<string, unknown>
    const choices = outer.choices as Array<{ delta?: Record<string, unknown> }> | undefined
    if (!choices || !choices[0]?.delta) return null
    return choices[0].delta
  } catch {
    return null
  }
}

/**
 * 从 delta 对象中提取 reasoning_content 文本片段
 */
function extractReasoningChunk(delta: Record<string, unknown>): string {
  const rc = delta.reasoning_content
  if (typeof rc === 'string') return rc
  if (rc && typeof (rc as Record<string, unknown>).text === 'string') {
    return (rc as { text: string }).text
  }
  return ''
}

/**
 * 从 delta 对象中提取 content 文本片段
 */
function extractContentChunk(delta: Record<string, unknown>): string {
  const c = delta.content
  if (typeof c === 'string') return c
  return ''
}

// ─── XML Tool Call Regexes ───────────────────────────────────────────────────

const TOOL_USE_BLOCK_RE = /<tool_use>([\s\S]*?)<\/tool_use>/g
const TOOL_NAME_RE = /<name>([\s\S]*?)<\/name>/
const TOOL_ARGS_RE = /<arguments>([\s\S]*?)<\/arguments>/

// ─── StreamParser Class ──────────────────────────────────────────────────────

export class StreamParser {
  private rawAccumulated = ''
  private toolIdCounter = 0

  /**
   * 追加原始流式文本，返回当前已解析的完整内容
   */
  append(chunk: string): ParsedContent {
    this.rawAccumulated += chunk
    return this.parse()
  }

  /**
   * 仅解析当前累积的原始文本，不改变状态
   */
  parse(): ParsedContent {
    return {
      reasoning: this.extractReasoning(),
      content: this.extractContent(),
      tools: this.extractTools(),
    }
  }

  /**
   * 重置解析器状态
   */
  reset(): void {
    this.rawAccumulated = ''
    this.toolIdCounter = 0
  }

  /**
   * 从原始累积文本中提取 reasoning 文本
   * 匹配 `"reasoning_content":"..."` 或 `"reasoning_content":"...`
   * 支持跨行的 JSON 字符串值
   */
  private extractReasoning(): string {
    const text = this.rawAccumulated
    const chunks: string[] = []
    // Match all occurrences of "reasoning_content":"..." in the raw text
    // Handle both escaped and unescaped strings
    const pattern = /"reasoning_content"\s*:\s*"(.*?)"/gs
    let m: RegExpExecArray | null
    while ((m = pattern.exec(text)) !== null) {
      const raw = m[1]
      // Unescape common JSON escapes
      const unescaped = raw
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
      chunks.push(unescaped)
    }
    return chunks.join('')
  }

  /**
   * 从原始累积文本中提取正文 content 文本
   * 排除 reasoning_content 字段后的 content 值
   */
  private extractContent(): string {
    const text = this.rawAccumulated
    const chunks: string[] = []

    // Match content deltas that are NOT inside a reasoning_content field
    // We use a regex that matches "content":"..." but skips if preceded by "reasoning_content"
    // Strategy: remove all reasoning_content segments first, then extract content

    const withoutReasoning = text.replace(
      /"reasoning_content"\s*:\s*"(?:[^"\\]|\\.)*"/gs,
      '"reasoning_content":""'
    )

    const pattern = /"content"\s*:\s*"(.*?)"/gs
    let m: RegExpExecArray | null
    while ((m = pattern.exec(withoutReasoning)) !== null) {
      const raw = m[1]
      const unescaped = raw
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
      chunks.push(unescaped)
    }
    // 剔除已被 extractTools() 识别过的 tool_use XML 块，避免正文与工具区块双重渲染
    return chunks.join('').replace(TOOL_USE_BLOCK_RE, '').trim()
  }

  /**
   * 从正文内容中提取 XML 格式的工具调用块
   */
  private extractTools(): ParsedTool[] {
    const content = this.extractContent()
    const tools: ParsedTool[] = []
    let m: RegExpExecArray | null

    TOOL_USE_BLOCK_RE.lastIndex = 0
    while ((m = TOOL_USE_BLOCK_RE.exec(content)) !== null) {
      const blockText = m[0]
      const inner = m[1]

      const nameMatch = inner.match(TOOL_NAME_RE)
      const argsMatch = inner.match(TOOL_ARGS_RE)

      const name = nameMatch ? nameMatch[1].trim() : ''
      const args = argsMatch ? argsMatch[1].trim() : ''

      if (name) {
        this.toolIdCounter++
        tools.push({
          id: `tool-${this.toolIdCounter}`,
          name,
          arguments: args,
          rawText: blockText,
        })
      }
    }

    return tools
  }
}

// ─── Utility: parse tool calls from a completed message ──────────────────────

/**
 * 从已完成消息的完整内容中解析 tool_use 块
 * 用于消息完成后重新解析（确保工具合并准确）
 */
export function parseToolsFromText(text: string): ParsedTool[] {
  const tools: ParsedTool[] = []
  let counter = 0
  let m: RegExpExecArray | null

  TOOL_USE_BLOCK_RE.lastIndex = 0
  while ((m = TOOL_USE_BLOCK_RE.exec(text)) !== null) {
    const blockText = m[0]
    const inner = m[1]
    const nameMatch = inner.match(TOOL_NAME_RE)
    const argsMatch = inner.match(TOOL_ARGS_RE)
    const name = nameMatch ? nameMatch[1].trim() : ''
    const args = argsMatch ? argsMatch[1].trim() : ''
    if (name) {
      counter++
      tools.push({
        id: `tool-${counter}`,
        name,
        arguments: args,
        rawText: blockText,
      })
    }
  }
  return tools
}
