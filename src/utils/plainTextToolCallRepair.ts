/**
 * utils/plainTextToolCallRepair.ts — 纯文本工具调用修复
 *
 * 某些模型将工具调用以 XML/JSON/纯文本形式写入响应内容而非结构化 tool_use block。
 * 此模块负责检测、提取和剥离这些纯文本工具调用。
 *
 * 设计原则：
 *   1. 只认明确携带「工具名 + 参数」的字段组合，绝不把任意 JSON 键当成工具名。
 *   2. JSON 解析使用括号平衡扫描，不使用 `[\s\S]*?` 跨字段乱匹配。
 *   3. 支持反代场景常见的「请求包 / 响应包」包裹格式与代码围栏。
 */

export interface PlainTextToolCallBlock {
  name: string;
  arguments: Record<string, unknown>;
}

/** 工具名字段候选（按优先级） */
const NAME_KEYS = ['tool_name', 'name', 'tool', 'function']
/** 参数值字段候选（按优先级） */
const ARGS_KEYS = ['arguments', 'input', 'parameters', 'args', 'params']

/**
 * 明确的工具调用标签：只认这些标签，避免把 <toolResponse> 等正文标签误判为工具。
 */
const TOOL_TAG_NAMES = 'tool_use|tool_call|toolcall|function_call|functioncall|invoke'
const TOOL_TAG_RE = new RegExp(`<(${TOOL_TAG_NAMES})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`, 'gi')
const TOOL_NAME_SUBTAG_RE = /<(?:name|tool_name|tool)>\s*([\s\S]*?)\s*<\/(?:name|tool_name|tool)>/i
const TOOL_ARGS_SUBTAG_RE = /<(?:arguments|input|parameters|args|params)>\s*([\s\S]*?)\s*<\/(?:arguments|input|parameters|args|params)>/i

/** 代码围栏：```json ... ``` 或 ``` ... ```（允许语言标识后紧跟内容，不强制换行） */
const FENCED_RE = /```[ \t]*(?:json|jsonc|javascript|js)?[ \t]*\r?\n?([\s\S]*?)```/gi

/**
 * 从字符串中定位一个处于平衡态的 JSON 对象（含首尾花括号）。
 * 正确跳过字符串字面量与转义，返回解析后的对象或 null。
 */
function readBalancedObject(text: string, startIdx: number): { value: Record<string, unknown>; end: number } | null {
  if (text[startIdx] !== '{') return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        const raw = text.slice(startIdx, i + 1)
        try {
          const parsed = JSON.parse(raw)
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return { value: parsed as Record<string, unknown>, end: i + 1 }
          }
        } catch {
          // 容错：给未加引号的键补引号后重试
          try {
            const repaired = raw.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
            const parsed = JSON.parse(repaired)
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              return { value: parsed as Record<string, unknown>, end: i + 1 }
            }
          } catch { /* ignore */ }
        }
        return null
      }
    }
  }
  return null
}

/**
 * 从任意 JSON 对象中提取工具名与参数。
 * 只有当对象含有「工具名字段」时才认定为工具调用；
 * 参数缺失时视为空参数（例如 pwd / list_dir 之类无参工具）。
 */
function extractToolFromObject(obj: Record<string, unknown>): PlainTextToolCallBlock | null {
  const directName = pickString(obj, NAME_KEYS)
  if (directName) {
    return { name: directName, arguments: normalizeArgs(lookupArgs(obj)) }
  }

  // 嵌套形式：{"function":{"name":..,"arguments":{..}}}
  const fn = obj.function
  if (fn && typeof fn === 'object' && !Array.isArray(fn)) {
    const fnObj = fn as Record<string, unknown>
    const fnName = pickString(fnObj, NAME_KEYS)
    if (fnName) {
      return { name: fnName, arguments: normalizeArgs(lookupArgs(fnObj)) }
    }
  }
  return null
}

/** 取出对象中第一个命中的参数字段值；未命中返回 null */
function lookupArgs(obj: Record<string, unknown>): unknown {
  for (const key of ARGS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key]
  }
  return null
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

/** 把参数统一成对象形式 */
function normalizeArgs(val: unknown): Record<string, unknown> {
  if (val == null) return {}
  if (typeof val === 'object' && !Array.isArray(val)) return val as Record<string, unknown>
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (!trimmed) return {}
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
      return { value: parsed }
    } catch {
      // 回退：key=value 行解析
      const result: Record<string, unknown> = {}
      for (const line of trimmed.split('\n')) {
        const eq = line.indexOf('=')
        if (eq > 0) {
          const k = line.slice(0, eq).trim()
          const v = line.slice(eq + 1).trim()
          if (k) result[k] = v
        }
      }
      return Object.keys(result).length > 0 ? result : { value: trimmed }
    }
  }
  return { value: val }
}

/** 从一段文本中扫描所有 JSON 对象并尝试识别为工具调用 */
function scanJsonObjects(text: string): PlainTextToolCallBlock[] {
  const blocks: PlainTextToolCallBlock[] = []
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue
    const found = readBalancedObject(text, i)
    if (!found) continue
    const block = extractToolFromObject(found.value)
    if (block) blocks.push(block)
    i = found.end - 1
  }
  return blocks
}

/** 收集明确 XML 标签中的工具调用 */
function collectTaggedTools(text: string): PlainTextToolCallBlock[] {
  const blocks: PlainTextToolCallBlock[] = []
  TOOL_TAG_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TOOL_TAG_RE.exec(text)) !== null) {
    const inner = m[2]
    const nameTag = inner.match(TOOL_NAME_SUBTAG_RE)
    const argsTag = inner.match(TOOL_ARGS_SUBTAG_RE)
    const name = nameTag ? nameTag[1].trim() : ''
    if (name) {
      blocks.push({ name, arguments: normalizeArgs(argsTag ? argsTag[1].trim() : '') })
    }
  }
  return blocks
}

/** 收集代码围栏内的 JSON 工具调用 */
function collectFencedJson(text: string): PlainTextToolCallBlock[] {
  const blocks: PlainTextToolCallBlock[] = []
  FENCED_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = FENCED_RE.exec(text)) !== null) {
    const body = m[1]
    if (!body || !body.includes('{')) continue
    for (const b of scanJsonObjects(body)) blocks.push(b)
  }
  return blocks
}

/**
 * 解析整段纯工具调用文本。
 * 支持：代码围栏内的 JSON 请求包、纯 JSON、明确标签包裹的 XML/JSON。
 * 仅当文本基本整段都是工具调用时才返回结果，否则返回 null 交由 extract 处理。
 */
export function parsePlainTextToolCalls(text: string): PlainTextToolCallBlock[] | null {
  if (!text || typeof text !== 'string') return null

  const tagged = collectTaggedTools(text)
  if (tagged.length > 0) return tagged

  const jsonBlocks = scanJsonObjects(text)
  if (jsonBlocks.length > 0) {
    const coverage = JSON.stringify(jsonBlocks).length / Math.max(text.length, 1)
    if (coverage > 0.3) return jsonBlocks
  }

  return null
}

/**
 * 从混合文本中提取工具调用块。
 * 返回文本中所有可识别的工具调用。
 */
export function extractPlainTextToolCalls(text: string): PlainTextToolCallBlock[] {
  if (!text || typeof text !== 'string') return []

  const tagged = collectTaggedTools(text)
  if (tagged.length > 0) return tagged

  const fenced = collectFencedJson(text)
  if (fenced.length > 0) return fenced

  return scanJsonObjects(text)
}

/** 响应包标识：#### 响应包 / ###响应包 / 响应包： 等变体 */
const RESPONSE_SECTION_RE = /(?:#{2,6}\s*)?响应包\s*[:：]?\s*$/i

/**
 * 从文本中剥离工具调用块，返回清理后的纯文本内容。
 * 工具调用（请求包）整段移除；响应包数据折叠为占位符，避免正文过长。
 */
export function stripPlainTextToolCalls(text: string): string {
  if (!text || typeof text !== 'string') return ''

  let cleaned = text.replace(TOOL_TAG_RE, '')

  // 逐个处理代码围栏：
  //   - 命中工具调用 → 整段移除（连同其前面的「请求包」标题）
  //   - 命中响应包数据 → 折叠为占位符
  //   - 请求包/响应包章节内的非 JSON 围栏（如 XML 声明）→ 整段移除
  FENCED_RE.lastIndex = 0
  cleaned = cleaned.replace(FENCED_RE, (full: string, body: string, offset: number) => {
    const before = cleaned.slice(0, offset).replace(/\s+$/, '')
    const inResponseSection = RESPONSE_SECTION_RE.test(before)

    if (!body || !body.includes('{')) {
      // 非 JSON 内容：仅当处于请求包/响应包章节时才作为噪声移除
      if (inResponseSection) return ''
      if (/(?:#{2,6}\s*)?请求包\s*[:：]?\s*$/i.test(before)) return ''
      return full
    }

    if (scanJsonObjects(body).length > 0) {
      // 工具调用块：整段移除
      return ''
    }

    if (inResponseSection) {
      const size = body.trim().length
      return '```\n[响应包已省略 ' + size + ' 字符]\n```'
    }
    return full
  })

  // 清理因移除工具包而残留的孤立标题行（如「####请求包」「#### 响应包」），
  // 这些标题在内容被移除后已无意义，且可能互相粘连
  cleaned = cleaned.replace(/^[ \t]*(?:#{2,6}\s*)?(?:请求包|响应包)\s*[:：]?[ \t]*(?=\r?\n|$)/gim, '')
  // 同行粘连的标题（如「####请求包#### 响应包」）
  cleaned = cleaned.replace(/(?:#{2,6}\s*)?(?:请求包|响应包)\s*[:：]?/gi, (m, off: number, src: string) => {
    const lineStart = src.lastIndexOf('\n', off - 1) + 1
    const lineEnd = src.indexOf('\n', off)
    const line = src.slice(lineStart, lineEnd === -1 ? src.length : lineEnd)
    const rest = line.replace(/(?:#{2,6}\s*)?(?:请求包|响应包)\s*[:：]?/gi, '').trim()
    return rest ? m : ''
  })

  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim()

  return cleaned
}
