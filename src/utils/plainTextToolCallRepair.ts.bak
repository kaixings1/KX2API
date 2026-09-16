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
 * 判断一个「候选工具名」是否像一个真实的注册命令标识符。
 *
 * 误判保护：当模型最终回复里出现 <name>...</name>（如接口文档、HTML 示例、
 * XML 片段里的 <name>用户</name>）时，这些不能当作工具调用，否则整段正文
 * 会被当作工具名清空（fullText=''）导致真实答案被丢弃。
 *
 * 规则：整体为 ASCII 字母/数字/下划线/横线/点（/冒号的命令路径），
 * 长度 1..64，且不含空白、逗号、中文、括号等明显非命令字符。
 */
export function isPlausibleToolName(name: string): boolean {
  if (!name || typeof name !== 'string') return false
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 64) return false
  // 必须以字母或下划线开头（命令标识符习惯），后续允许字母数字 _-. / :
  if (!/^[A-Za-z_][A-Za-z0-9_.\-/:]*$/.test(trimmed)) return false
  // 排除纯数字、空壳
  if (/^[0-9_.\-/:]+$/.test(trimmed)) return false
  return true
}

/**
 * 明确的工具调用标签：只认这些标签，避免把 <toolResponse> 等正文标签误判为工具。
 * 同时兼容驼峰风格（toolName / toolCallId / functionCall）标签。
 */
const TOOL_TAG_NAMES = 'tool_use|tool_call|toolcall|function_call|functioncall|invoke|tool_normal'
const TOOL_TAG_RE = new RegExp(`<(${TOOL_TAG_NAMES})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`, 'gi')
// 名字子标签：支持 tool_name / toolName / name / tool / function / fn
const TOOL_NAME_SUBTAG_RE = /<(?:tool_name|toolName|toolname|name|tool|fn)>\s*([\s\S]*?)\s*<\/(?:tool_name|toolName|toolname|name|tool|fn)>/i
const TOOL_ARGS_SUBTAG_RE = /<(?:arguments|input|args|params|parameters)>\s*([\s\S]*?)\s*<\/(?:arguments|input|args|params|parameters)>/i

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
  // OpenAI 兼容格式：{"tool_calls": [{"name":...,"parameters":{...}}]}
  const tc = obj.tool_calls
  if (Array.isArray(tc) && tc.length > 0) {
    const first = tc[0]
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      const tcObj = first as Record<string, unknown>
      const tcName = pickString(tcObj, NAME_KEYS)
      if (tcName) {
        return { name: tcName, arguments: normalizeArgs(lookupArgs(tcObj)) }
      }
    }
  }

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

/** 收集明确 XML 标签中的工具调用（不限定外层包裹标签名，兼容 camelCase 与任意命名） */
function collectTaggedTools(text: string): PlainTextToolCallBlock[] {
  const blocks: PlainTextToolCallBlock[] = []
  // 通用 XML 元素扫描：匹配任意 <tag...>...</tag>（允许嵌套与任意标签名）
  const ANY_XML_EL_RE = /<([a-zA-Z_][\w:\-]*)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi
  let m: RegExpExecArray | null
  while ((m = ANY_XML_EL_RE.exec(text)) !== null) {
    const inner = m[2]
    // 内里必须出现「工具名字声明」或「参数声明」，否则是普通正文/容器，跳过
    const nameTag = inner.match(TOOL_NAME_SUBTAG_RE)
    if (!nameTag) continue
    const name = nameTag[1].replace(/<[^>]*>/g, '').trim()
    if (!name) continue
    // 误判保护：名字不是合法的命令标识符（如 <name>用户</name>、<tool>分析</tool>）
    // 则不认为是工具调用，避免把 AI 纯文本正文（接口文档/HTML 示例）当作工具吞掉。
    if (!isPlausibleToolName(name)) continue
    const argsTag = inner.match(TOOL_ARGS_SUBTAG_RE)
    // 进一步的误判保护：当工具名用的是通用标签（name / tool / fn，而非 toolName），
    // 必须同时存在 <arguments> 兄弟标签，否则极可能是文档里的 <name> 文本，不应视为工具。
    const isGenericNameTag = /^<(?:name|tool|fn)[\s>]/i.test(nameTag[0])
    if (isGenericNameTag && !argsTag) continue
    let argumentsObj: Record<string, unknown> = {}
    if (argsTag) {
      // 优先把 XML 子标签（<path>.</path>）解析为参数对象
      const parsed = parseXmlArgs(argsTag[1])
      if (parsed.ok) argumentsObj = parsed.value
      else {
        const innerText = argsTag[1].replace(/<\/?[^>]+>/g, '').trim()
        argumentsObj = normalizeArgs(innerText)
      }
    }
    blocks.push({ name, arguments: argumentsObj })
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
 * 把 XML 子标签（如 <path>.</path>、<showHidden>false</showHidden>）解析为参数对象。
 * 支持：
 *   - 纯文本子标签：<key>value</key>
 *   - JSON 字符串子标签：<key>{"a":1}</key>
 * 仅当至少解析出一个键值对时返回对象，否则返回 null（交由 normalizeArgs 兜底）。
 */
function parseXmlArgs(inner: string): { value: Record<string, unknown>; ok: boolean } {
  const out: Record<string, unknown> = {}
  const CHILD_RE = /<\s*([a-zA-Z_][\w-]*)\b[^>]*>([\s\S]*?)<\s*\/\s*\1\s*>/g
  CHILD_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = CHILD_RE.exec(inner)) !== null) {
    const key = m[1].trim()
    const val = m[2].trim()
    if (!key) continue
    // 忽略工具调用自身的包裹/名字标签
    if (/^(toolName|tool_name|name|tool|toolCallId|tool_call_id|function|fn|type)$/i.test(key)) continue
    // 尝试把纯 JSON 文本解析为对象，否则保留字符串
    if (val.startsWith('{') || val.startsWith('[')) {
      try { out[key] = JSON.parse(val); continue } catch { /* 保留字符串 */ }
    }
    out[key] = val
  }
  return { value: out, ok: Object.keys(out).length > 0 }
}

/**
 * 收集「扁平 XML 工具调用」——即没有外层 <tool_call> 包裹、直接以
 * <toolName>xxx</toolName> + <arguments>...</arguments> 平铺的调用。
 * 这是不少模型在 system prompt 学过 XML 工具协议后爱输出的形态。
 * 逐个 nudge：只要文本里出现 toolName/tool_name/name 且后随 arguments，就认定为一个工具。
 */
function collectFlatXmlTools(text: string): PlainTextToolCallBlock[] {
  const blocks: PlainTextToolCallBlock[] = []
  // 匹配独立的 <toolName> / <tool_name> / <toolname> / <tool> / <fn> 及其后紧跟的 <arguments> 兄弟标签。
  // 关键：不匹配裸 <name>（极易与正文/文档里的 <name> 标签误判），只认带「工具」语义的标签。
  const FLAT_RE = /<\s*(toolName|tool_name|toolname|tool|fn)\b[^>]*>\s*([\s\S]*?)\s*<\/\s*(?:toolName|tool_name|toolname|tool|fn)\s*>([\s\S]{0,1600}?)(?=<\s*(?:toolName|tool_name|toolname|tool|fn)\b|<\/(?:toolCall|tool_call|xml)\s*>|$)/gi
  FLAT_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = FLAT_RE.exec(text)) !== null) {
    const rawName = m[2].trim()
    // 名称可能被包裹在其它标签里（如 <name><value>current_directory</value></name>），取最后一段文本
    const name = rawName.replace(/<[^>]*>/g, '').trim()
    if (!name) continue
    // 误判保护：非法命令标识符（含空格/中文/纯数字等）不认定，保护正文
    if (!isPlausibleToolName(name)) continue
    const trailing = m[3] || ''
    // 在该 name 标签之后找 <arguments>...</arguments>
    const argsM = trailing.match(/<arguments?\b[^>]*>([\s\S]*?)<\/arguments?\b[^>]*>/i)
    // 通用标签（tool / fn）若后无 <arguments>，多为正文，不应视为工具
    if (/^<\s*(?:tool|fn)[\s>]/i.test(m[0]) && !argsM) continue
    let argumentsObj: Record<string, unknown> = {}
    if (argsM) {
      const parsed = parseXmlArgs(argsM[1])
      if (parsed.ok) argumentsObj = parsed.value
      else {
        const innerText = argsM[1].replace(/<\/?[^>]+>/g, '').trim()
        argumentsObj = normalizeArgs(innerText)
      }
    }
    blocks.push({ name, arguments: argumentsObj })
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

  // 扁平 XML 工具调用（无外层包裹、camelCase 子标签）
  const flatXml = collectFlatXmlTools(text)
  if (flatXml.length > 0) return flatXml

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

  const flatXml = collectFlatXmlTools(text)
  if (flatXml.length > 0) return flatXml

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

  // 剥离「含工具名声明的任意 XML 元素」：兼容 <toolCall> / <ToolCall> / <tool_call> 及扁平形态。
  // 用回调扫描通用 XML 元素，凡内里出现 toolName/tool_name/name 子标签即整段移除。
  let cleaned = text
  const STRIP_XML_EL_RE = /<([a-zA-Z_][\w:\-]*)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi
  cleaned = cleaned.replace(STRIP_XML_EL_RE, (full: string, _tag: string, inner: string) => {
    if (TOOL_NAME_SUBTAG_RE.test(inner)) return ''
    return full
  })

  // 剥离扁平 XML 工具调用（无外层包裹）：<toolName>..</toolName> 与紧随的 <arguments>..</arguments>
  cleaned = cleaned.replace(
    /<\s*(toolName|tool_name|toolname|name)\b[^>]*>\s*[\s\S]*?\s*<\/\s*(?:toolName|tool_name|toolname|name)\s*>(?:\s*<\s*arguments?\b[^>]*>[\s\S]*?<\/\s*arguments?\s*>)?/gi,
    ''
  )

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
