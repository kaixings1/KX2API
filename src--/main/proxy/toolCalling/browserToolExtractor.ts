/**
 * Browser Tool Call Extractor
 *
 * 专门用于浏览器插件 / content script / DOM 场景的工具调用提取。
 * 与纯文本提取器（toolCallExtractor.ts）互补，处理浏览器环境特有的信号：
 *
 *   - 网络层：fetch / XMLHttpRequest 拦截到的原始请求体和 SSE/NDJSON 流式响应
 *   - DOM 层：页面中 <script> 标签内的工具调用、data-tool-* 属性、全局变量快照
 *   - Content Script：注入页面的 API 调用记录
 *
 * 设计原则：
 *   1. 所有方法都是纯函数，不依赖 DOM / chrome.* API（调用方负责注入环境）
 *   2. 与现有的 ToolCallExtractor 复用相同的类型和工具函数
 *   3. 无法解析时返回空结果，不抛异常
 */

import type { ExtractedToolCall, ExtractionResult } from './toolCallExtractor.ts'
import { stableStringify, readBalancedJson } from './protocols/shared.ts'

/** Basic JSON parse with JS object literal repair (quote unquoted keys) */
function tryParseJSON(str: string): unknown | null {
  const trimmed = str.trim()
  try { return JSON.parse(trimmed) } catch {
    // Attempt to repair JS object literals: { file_path: "x" } -> { "file_path": "x" }
    const repaired = trimmed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
    try { return JSON.parse(repaired) } catch { return null }
  }
}

// ─── 公共类型 ────────────────────────────────────────────────────

/**
 * 原始 HTTP 请求的元信息，用于从请求体中推断工具调用
 */
export interface RawHttpRequest {
  url: string
  method: string
  headers?: Record<string, string>
  body?: string
}

/**
 * 原始 HTTP 响应的元信息
 */
export interface RawHttpResponse {
  status: number
  headers?: Record<string, string>
  body?: string
  /** 如果是流式响应，提供已接收的文本块序列 */
  streamChunks?: string[]
}

/**
 * DOM 快照信息
 */
export interface DomSnapshot {
  /** 页面 <script> 标签内容 */
  scriptContents?: string[]
  /** 页面中带有 data-tool-* 属性的元素属性 */
  toolAttributes?: Array<{ selector: string; attributes: Record<string, string> }>
  /** 页面全局变量快照（仅包含工具调用相关变量） */
  globalToolVars?: Record<string, unknown>
}

/**
 * Content Script 记录的 API 调用
 */
export interface ApiCallRecord {
  url: string
  method: string
  requestBody?: unknown
  responseBody?: unknown
  timestamp?: number
}

/**
 * 浏览器提取选项
 */
export interface BrowserExtractOptions {
  /** 从请求体中提取（默认 true） */
  extractFromRequest?: boolean
  /** 从响应体中提取（默认 true） */
  extractFromResponse?: boolean
  /** 从流式响应块中提取（默认 true） */
  extractFromStream?: boolean
  /** 从 DOM 快照中提取（默认 true） */
  extractFromDom?: boolean
  /** 从 content script API 记录中提取（默认 true） */
  extractFromApiRecords?: boolean
  /** 是否提取工具 schema 定义（默认 false，仅提取调用） */
  extractSchemas?: boolean
  /** 最小置信度阈值 */
  minConfidence?: 'high' | 'medium' | 'low'
  /** 每次提取的最大工具调用数 */
  maxCalls?: number
}

const DEFAULT_OPTIONS: Required<BrowserExtractOptions> = {
  extractFromRequest: true,
  extractFromResponse: true,
  extractFromStream: true,
  extractFromDom: true,
  extractFromApiRecords: true,
  extractSchemas: false,
  minConfidence: 'medium',
  maxCalls: 50,
}

// ─── 工具函数 ─────────────────────────────────────────────────────

function meetsConfidence(call: { confidence: 'high' | 'medium' | 'low' }, threshold: 'high' | 'medium' | 'low'): boolean {
  const levels = { high: 3, medium: 2, low: 1 }
  return levels[call.confidence] >= levels[threshold]
}

function makeCall(
  name: string,
  args: unknown,
  confidence: 'high' | 'medium' | 'low' = 'medium',
  rawText?: string,
): ExtractedToolCall {
  const parsedArgs = typeof args === 'string' ? (tryParseJSON(args) ?? args) : args
  return {
    id: `call_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`,
    type: 'function',
    function: {
      name,
      arguments: typeof parsedArgs === 'string' ? parsedArgs : JSON.stringify(parsedArgs ?? {}),
    },
    confidence,
    rawText,
  }
}

// ─── 网络层提取 ──────────────────────────────────────────────────

/**
 * 从原始 HTTP 请求体中提取工具调用
 * 处理：
 *   - OpenAI 标准格式（含 tool_calls 字段的消息体）
 *   - 直接包含工具调用的 JSON 体
 *   - MCP JSON-RPC 调用
 */
export function extractFromHttpRequest(req: RawHttpRequest): ExtractedToolCall[] {
  if (!req.body || typeof req.body !== 'string') return []

  const calls: ExtractedToolCall[] = []
  const seen = new Set<string>()

  const add = (call: ExtractedToolCall) => {
    const key = `${call.function.name}:${call.function.arguments}`
    if (!seen.has(key)) {
      seen.add(key)
      calls.push(call)
    }
  }

  const body = req.body

  // 1. OpenAI tool_calls 格式：{"messages":[...],"tools":[...]}
  const openAiPattern = /"tool_calls"\s*:\s*\[([\s\S]*?)\]/i
  let match = openAiPattern.exec(body)
  if (match) {
    const parsed = tryParseJSON(`[${match[1]}]`)
    if (Array.isArray(parsed)) {
      for (const tc of parsed) {
        if (tc.function?.name) {
          add(makeCall(tc.function.name, tc.function.arguments, 'high', match![0]))
        }
      }
    }
  }

  // 2. 直接发送的工具调用数组：[{"name":"...","arguments":{...}}]
  if (calls.length === 0 && body.trim().startsWith('[')) {
    const parsed = tryParseJSON(body)
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item.function?.name) {
          add(makeCall(item.function.name, item.function.arguments, 'high'))
        } else if (item.name) {
          add(makeCall(item.name, item.arguments ?? item.args ?? {}, 'medium'))
        }
      }
    }
  }

  // 3. MCP JSON-RPC 调用：{"method":"tools/call","params":{"name":"...","arguments":{...}}}
  const mcpPattern = /"method"\s*:\s*"tools\/call"\s*,\s*"params"\s*:\s*\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[\s\S]*?\})\s*\}/i
  match = mcpPattern.exec(body)
  if (match) {
    add(makeCall(match[1], tryParseJSON(match[2]) ?? match[2], 'high', match![0]))
  }

  // 4. MCP tools/call 简写格式
  const mcpSimple = /"method"\s*:\s*"([^"]+)"\s*,\s*"params"\s*:\s*\{\s*"arguments"\s*:\s*(\{[\s\S]*?\})\s*\}/i
  match = mcpSimple.exec(body)
  if (match) {
    add(makeCall(match[1], tryParseJSON(match[2]) ?? match[2], 'medium', match![0]))
  }

  return calls
}

/**
 * 从原始 HTTP 响应体中提取工具调用
 * 处理：
 *   - OpenAI 标准响应格式
 *   - 直接包含 tool_calls 的 JSON 响应
 *   - GLM 网页版的特殊格式
 */
export function extractFromHttpResponse(resp: RawHttpResponse): ExtractedToolCall[] {
  if (!resp.body || typeof resp.body !== 'string') return []

  const calls: ExtractedToolCall[] = []
  const seen = new Set<string>()

  const add = (call: ExtractedToolCall) => {
    const key = `${call.function.name}:${call.function.arguments}`
    if (!seen.has(key)) {
      seen.add(key)
      calls.push(call)
    }
  }

  const body = resp.body

  // 1. OpenAI 标准响应：{"choices":[{"message":{"tool_calls":[...]}}]}
  const choicePattern = /"choices"\s*:\s*\[[^\]]*"message"\s*:\s*\{[^\}]*"tool_calls"\s*:\s*\[([\s\S]*?)\]\s*\}/
  let match = choicePattern.exec(body)
  if (match) {
    const parsed = tryParseJSON(`[${match[1]}]`)
    if (Array.isArray(parsed)) {
      for (const tc of parsed) {
        if (tc.function?.name) {
          add(makeCall(tc.function.name, tc.function.arguments, 'high', match![0]))
        }
      }
    }
  }

  // 2. 直接 tool_calls 字段
  if (calls.length === 0) {
    const tcPattern = /"tool_calls"\s*:\s*\[([\s\S]*?)\]\s*\}/
    match = tcPattern.exec(body)
    if (match) {
      const parsed = tryParseJSON(`[${match[1]}]`)
      if (Array.isArray(parsed)) {
        for (const tc of parsed) {
          if (tc.function?.name) {
            add(makeCall(tc.function.name, tc.function.arguments, 'high', match![0]))
          }
        }
      }
    }
  }

  // 3. GLM 网页版格式：在 content 字段中包含 XML 工具调用标记
  if (calls.length === 0) {
    const parsed = tryParseJSON(body)
    if (parsed && typeof parsed === 'object' && parsed !== null) {
      const obj = parsed as Record<string, unknown>
      const choices = obj.choices
      if (Array.isArray(choices) && choices[0]?.message?.content) {
        const content = String(choices[0].message.content)
        // 提取 KX2API 标记中的工具调用（逐标签解析，避免嵌套参数破坏正则）
        const invokeStarts = /<\|KX2API\|invoke\s+name="([^"]+)"[^>]*>/g
        let m
        while ((m = invokeStarts.exec(content)) !== null) {
          const name = m[1]
          const afterOpen = content.slice(m.index + m[0].length)
          const closeIdx = afterOpen.indexOf('</|KX2API|invoke>')
          if (closeIdx === -1) break
          const inner = afterOpen.slice(0, closeIdx)
          const args: Record<string, unknown> = {}
          const paramRegex = /<\|KX2API\|parameter\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/\|KX2API\|parameter>/g
          let pm
          while ((pm = paramRegex.exec(inner)) !== null) {
            args[pm[1]] = pm[2].trim()
          }
          add(makeCall(name, Object.keys(args).length > 0 ? args : {}, 'high', m[0] + inner + '</|KX2API|invoke>'))
        }
      }
    }
  }

  // 4. Anthropic tool_use 格式
  if (calls.length === 0) {
    const anthropicPattern = /"type"\s*:\s*"tool_use"\s*,\s*"name"\s*:\s*"([^"]+)"\s*,\s*"input"\s*:\s*(\{[\s\S]*?\})/g
    match = anthropicPattern.exec(body)
    if (match) {
      add(makeCall(match[1], tryParseJSON(match[2]) ?? match[2], 'high', match![0]))
    }
  }

  return calls
}

/**
 * 从流式响应块（NDJSON / SSE）中提取工具调用
 * 处理：data: {...}\n\n 格式的逐块解析
 */
export function extractFromStreamChunks(chunks: string[]): ExtractedToolCall[] {
  const allCalls: ExtractedToolCall[] = []
  const seen = new Set<string>()

  const add = (call: ExtractedToolCall) => {
    const key = `${call.function.name}:${call.function.arguments}`
    if (!seen.has(key)) {
      seen.add(key)
      allCalls.push(call)
    }
  }

  // 逐块累积并解析
  let buffer = ''
  for (const chunk of chunks) {
    buffer += chunk

    // 1. NDJSON 行格式（支持 "data: {...}" SSE 格式）
    const lines = buffer.split('\n')
    for (const line of lines) {
      let trimmed = line.trim()

      // 支持 SSE 的 data: 前缀（必须在 startsWith('{') 检查之前处理）
      if (trimmed.startsWith('data:')) {
        trimmed = trimmed.slice(5).trim()
      }

      if (!trimmed.startsWith('{')) continue

      const parsed = tryParseJSON(trimmed)
      if (!parsed || typeof parsed !== 'object') continue

      // OpenAI 流式 tool_calls delta
      if (parsed.choices?.[0]?.delta?.tool_calls) {
        for (const tc of parsed.choices[0].delta.tool_calls) {
          if (tc.function?.name || tc.id) {
            const name = tc.function?.name ?? tc.name ?? 'unknown'
            const args = tc.function?.arguments ?? tc.arguments ?? tc.input ?? '{}'
            add(makeCall(name, typeof args === 'string' ? args : args, 'high'))
          }
        }
      }

      // Anthropic 流式 content_block_start
      if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'tool_use') {
        const block = parsed.content_block
        add(makeCall(block.name, block.input ?? {}, 'high'))
      }
    }

    // 2. 累积文本中的 KX2API 标记（应对碎片化）
    const kx2apiPattern = /<\|KX2API\|invoke\s+name="([^"]+)"([\s\S]*?)<\/\|KX2API\|invoke>/g
    let m
    while ((m = kx2apiPattern.exec(buffer)) !== null) {
      const name = m[1]
      const paramMatches = buffer.matchAll(/<\|KX2API\|parameter\s+name="([^"]+)"([\s\S]*?)<\/\|KX2API\|parameter>/g)
      const args: Record<string, unknown> = {}
      for (const pm of paramMatches) {
        args[pm[1]] = pm[2].trim()
      }
      add(makeCall(name, Object.keys(args).length > 0 ? args : {}, 'medium', m[0]))
    }
  }

  return allCalls.slice(0, 50)
}

// ─── DOM 层提取 ──────────────────────────────────────────────────

/**
 * 从 DOM 快照中提取工具调用
 * 处理：
 *   - <script> 标签内的工具调用代码
 *   - data-tool-call / data-tool-name / data-tool-args 属性
 *   - 全局变量（如 window.__TOOL_CALLS__）
 */
export function extractFromDom(snapshot: DomSnapshot): ExtractedToolCall[] {
  const calls: ExtractedToolCall[] = []
  const seen = new Set<string>()

  const add = (call: ExtractedToolCall) => {
    const key = `${call.function.name}:${call.function.arguments}`
    if (!seen.has(key)) {
      seen.add(key)
      calls.push(call)
    }
  }

  // 1. <script> 标签内容
  if (snapshot.scriptContents) {
    for (const script of snapshot.scriptContents) {
      // 查找 window.__TOOL_CALLS__ 或类似的全局变量
      const globalMatch = /(?:window|globalThis|self)\.__TOOL_CALLS__\s*=\s*(\[[\s\S]*?\])/i.exec(script)
      if (globalMatch) {
        const parsed = tryParseJSON(globalMatch[1])
        if (Array.isArray(parsed)) {
          for (const tc of parsed) {
            if (tc.function?.name || tc.name) {
              add(makeCall(tc.function?.name ?? tc.name, tc.function?.arguments ?? tc.arguments ?? tc.args ?? {}, 'high', globalMatch[0]))
            }
          }
        }
      }

      // 查找直接的函数调用式工具使用：Read({...}), Write({...}) 等
      const fnCalls = /\b(Bash|Read|Write|Edit|Grep|Glob|ListFiles|WebSearch|CodeInterpreter)\s*\(\s*(\{[\s\S]*?\})\s*\)/gi
      let fnMatch
      while ((fnMatch = fnCalls.exec(script)) !== null) {
        const parsed = tryParseJSON(fnMatch[2])
        if (parsed) {
          add(makeCall(fnMatch[1], parsed, 'high', fnMatch[0]))
        }
      }

      // 查找对象字面量数组形式的工具调用：[{ name: "...", arguments: {...} }]
      // 使用平衡括号提取以避免嵌套对象破坏正则
      const objPattern = /name\s*:\s*["']([^"']+)["']\s*,\s*arguments\s*:\s*\{/
      const objMatch = objPattern.exec(script)
      if (objMatch) {
        const name = objMatch[1]
        const braceStart = script.indexOf('{', objMatch.index + objMatch[0].length - 1)
        if (braceStart !== -1) {
          const argsStr = readBalancedJson(script, braceStart)
          if (argsStr) {
            const parsedArgs = tryParseJSON(argsStr.json)
            if (parsedArgs) {
              add(makeCall(name, parsedArgs, 'high', script.slice(objMatch.index, argsStr.end)))
            }
          }
        }
      }

      // 查找 KX2API XML 格式
      const kx2apiPattern = /<\|KX2API\|(?:tool_calls|invoke)[\s\S]*?<\/\|KX2API\|tool_calls>/g
      let kx2apiMatch
      while ((kx2apiMatch = kx2apiPattern.exec(script)) !== null) {
        const content = kx2apiMatch[0]
        const invokePattern = /<\|KX2API\|invoke\s+name="([^"]+)"[^>]*>(?:<\|KX2API\|parameter[^>]*>([\s\S]*?)<\/\|KX2API\|parameter>)*<\/\|KX2API\|invoke>/g
        let invokeMatch
        while ((invokeMatch = invokePattern.exec(content)) !== null) {
          const name = invokeMatch[1]
          const paramMatches = content.matchAll(/<\|KX2API\|parameter\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/\|KX2API\|parameter>/g)
          const args: Record<string, unknown> = {}
          for (const pm of paramMatches) {
            args[pm[1]] = pm[2].trim()
          }
          add(makeCall(name, Object.keys(args).length > 0 ? args : {}, 'high', invokeMatch[0]))
        }
      }
    }
  }

  // 2. data-tool-* 属性
  if (snapshot.toolAttributes) {
    for (const el of snapshot.toolAttributes) {
      const name = el.attributes['data-tool-name'] || el.attributes['data-tool'] || el.attributes['data-tool-call']
      const argsStr = el.attributes['data-tool-args'] || el.attributes['data-tool-arguments'] || '{}'
      if (name) {
        add(makeCall(name, tryParseJSON(argsStr) ?? argsStr, 'medium', el.selector))
      }
    }
  }

  // 3. 全局变量快照
  if (snapshot.globalToolVars) {
    for (const [key, value] of Object.entries(snapshot.globalToolVars)) {
      if (key.includes('tool') || key.includes('TOOL') || key.includes('call')) {
        const arr = Array.isArray(value) ? value : [value]
        for (const item of arr) {
          if (typeof item === 'object' && item !== null) {
            const obj = item as Record<string, unknown>
            const name = obj.name ?? obj.function?.name ?? obj.tool_name
            const args = obj.arguments ?? obj.args ?? obj.input ?? obj.function?.arguments ?? obj.parameters ?? {}
            if (name && typeof name === 'string') {
              add(makeCall(name, args, 'high', key))
            }
          }
        }
      }
    }
  }

  return calls
}

// ─── Content Script API 记录提取 ──────────────────────────────────

/**
 * 从 content script 记录的 API 调用中提取工具调用
 * 这是浏览器插件特有的场景：通过拦截 fetch/XHR 获取原始请求/响应
 */
export function extractFromApiRecords(records: ApiCallRecord[]): ExtractedToolCall[] {
  const calls: ExtractedToolCall[] = []
  const seen = new Set<string>()

  const add = (call: ExtractedToolCall) => {
    const key = `${call.function.name}:${call.function.arguments}`
    if (!seen.has(key)) {
      seen.add(key)
      calls.push(call)
    }
  }

  for (const record of records) {
    // 从请求体中提取（POST 请求才携带工具调用）
    if (record.method === 'POST' && record.requestBody) {
      const bodyStr = typeof record.requestBody === 'string' ? record.requestBody : JSON.stringify(record.requestBody)

      // OpenAI 格式请求体
      const openAiReq = /"tool_choice"\s*:\s*(?:"none"|"auto"|"required"|\{[^}]+\})\s*,\s*"messages"\s*:\s*\[/i
      if (openAiReq.test(bodyStr)) {
        const reqCalls = extractFromHttpRequest({ url: record.url, method: record.method, body: bodyStr })
        for (const tc of reqCalls) add(tc)
      }
    }

    // 从响应体中提取
    if (record.responseBody) {
      const bodyStr = typeof record.responseBody === 'string' ? record.responseBody : JSON.stringify(record.responseBody)

      // OpenAI 响应
      if (bodyStr.includes('"tool_calls"')) {
        const respCalls = extractFromHttpResponse({ status: 200, body: bodyStr })
        for (const tc of respCalls) add(tc)
      }

      // SSE 流式响应
      if (record.streamChunks && record.streamChunks.length > 0) {
        const streamCalls = extractFromStreamChunks(record.streamChunks)
        for (const tc of streamCalls) add(tc)
      }
    }
  }

  return calls
}

// ─── 统一入口 ─────────────────────────────────────────────────────

/**
 * 主入口：从浏览器插件的多种信号源中提取工具调用
 */
export class BrowserToolCallExtractor {
  private options: Required<BrowserExtractOptions>
  private seenKeys = new Set<string>()

  constructor(options: BrowserExtractOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  reset(): void {
    this.seenKeys.clear()
  }

  /**
   * 从浏览器插件收集的所有信号中提取工具调用
   */
  extract(signals: {
    requests?: RawHttpRequest[]
    responses?: RawHttpResponse[]
    domSnapshot?: DomSnapshot
    apiRecords?: ApiCallRecord[]
  }): ExtractionResult {
    const toolCalls: ExtractedToolCall[] = []
    const rawMatches: string[] = []

    const add = (call: ExtractedToolCall) => {
      const key = `${call.function.name}:${stableStringify(call.function.arguments)}`
      if (this.seenKeys.has(key)) return
      if (!meetsConfidence(call, this.options.minConfidence)) return
      this.seenKeys.add(key)
      toolCalls.push(call)
      if (call.rawText) rawMatches.push(call.rawText)
    }

    // 网络层：请求
    if (this.options.extractFromRequest && signals.requests) {
      for (const req of signals.requests) {
        for (const tc of extractFromHttpRequest(req)) add(tc)
      }
    }

    // 网络层：响应
    if (this.options.extractFromResponse && signals.responses) {
      for (const resp of signals.responses) {
        for (const tc of extractFromHttpResponse(resp)) add(tc)
      }
    }

    // 网络层：流式块
    if (this.options.extractFromStream && signals.responses) {
      for (const resp of signals.responses) {
        if (resp.streamChunks && resp.streamChunks.length > 0) {
          for (const tc of extractFromStreamChunks(resp.streamChunks)) add(tc)
        }
      }
    }

    // DOM 层
    if (this.options.extractFromDom && signals.domSnapshot) {
      for (const tc of extractFromDom(signals.domSnapshot)) add(tc)
    }

    // Content Script API 记录
    if (this.options.extractFromApiRecords && signals.apiRecords) {
      for (const tc of extractFromApiRecords(signals.apiRecords)) add(tc)
    }

    // 截断到最大数量
    const limited = toolCalls.slice(0, this.options.maxCalls)

    return {
      content: '',
      toolCalls: limited,
      protocol: limited.length > 0 ? 'browser_extracted' : 'unknown',
      rawMatches,
    }
  }
}
