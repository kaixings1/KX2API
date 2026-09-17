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

/**
 * 跨模块别名兜底：`list_dir`、`list_directory` 这类模型自造名 → 注册命令名。
 *
 * 动态 import 是为避免在 `src/utils/` 里静态依赖 `src/engine/toolNameResolver`，
 * 产生 electron-vite 打包时符号被 chunk 重命名（如 resolveToolName → resolveToolName2）
 * 导致运行时解构不到的风险 —— 与 toolNameResolver 里注释记录的坑同源。
 * 但 TOOL_ALIASES 是纯数据（无函数引用），用静态具名 export + 动态 import 取常量即可。
 */
let aliasMapCache: Record<string, string> | null = null
function getAliasMap(): Record<string, string> {
  if (aliasMapCache) return aliasMapCache
  // 同步内联兜底（方向：模型自造名 → 真实注册命令名），
  // 避免依赖 toolNameResolver 的具体路径/导出被改变而失效。
  aliasMapCache = {
    // 目录 / 文件列举
    'list_dir': 'ls', 'list_directory': 'ls', 'list_files': 'ls',
    'ls_dir': 'ls', 'dir_list': 'dir', 'read_directory': 'ls',
    'show_directory': 'ls', 'current_directory': 'pwd',
    '_current_directory': 'pwd', 'get_current_directory': 'pwd',
    // local_* 系
    'local_dir': 'ls', 'local_directory': 'ls', 'local_dirs': 'ls',
    'local_list': 'ls', 'local_list_dir': 'ls', 'local_dir_list': 'dir',
    'local_list_directory': 'ls', 'local_files': 'ls',
    // 文件读取 / 搜索
    'read_file': 'cat', 'get_file': 'cat', 'readfile': 'cat',
    'search_files': 'find', 'find_file': 'find', 'find_files': 'find',
    'search_text': 'findstr', 'findstr_search': 'findstr',
    'grep_search': 'grep', 'search_files2': 'grep',
    // 系统 / 环境
    'current_path': 'pwd', 'print_directory': 'pwd', 'print_working_directory': 'pwd',
  }
  return aliasMapCache
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
 * 白名单校验：名字必须确实是**当前生效工具集**里的工具。
 *
 * 这是比形状校验强得多的守门 —— `isPlausibleToolName` 只保证"长得像命令"，
 * 但接口文档里的 `<name>get_user</name>`、示例代码里的 `[tool:bash]` 同样
 * "长得像命令"，仍会被误判为工具调用并把真实正文剥离掉（内容静默消失，
 * 比误转换更隐蔽）。
 *
 * 未提供白名单时退回形状校验（保持向后兼容）。
 */
export function isAllowedToolName(
  name: string,
  allowedNames?: ReadonlySet<string> | null,
): boolean {
  if (!isPlausibleToolName(name)) return false
  // 未提供白名单 → 退回形状校验（向后兼容既有调用方）
  if (!allowedNames) return true
  // 提供了但为空集 → 明确表示"本轮无任何可用工具"，此时不存在合法的工具调用，
  // 一律拒绝。这与"未提供"是两种不同语义，不能合并处理。
  if (allowedNames.size === 0) return false
  const trimmed = name.trim()
  if (allowedNames.has(trimmed)) return true
  // 兼容带前缀/大小写差异的写法（如 mcp__fs__read 与 fs.read）
  const lower = trimmed.toLowerCase()
  for (const allowed of allowedNames) {
    if (allowed.toLowerCase() === lower) return true
  }
  // 别名兜底：模型自造名（list_dir、list_directory、read_file 等）虽不在精确白名单，
  // 但能归一化到真实注册命令（ls/dir/cat...）时同样放行。
  // 否则这些调用会在 guaranteed 判定失败后被当成"非法的"文本修复目标，
  // 导致 list_dir 这类常见自造名永远进不了 toolCalls（见 toolNameResolver 的 TOOL_ALIASES）。
  const alias = getAliasMap()[lower]
  if (alias && allowedNames.has(alias)) return true
  return false
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
function scanJsonObjects(
  text: string,
  allowedNames?: ReadonlySet<string> | null,
): PlainTextToolCallBlock[] {
  const blocks: PlainTextToolCallBlock[] = []
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue
    const found = readBalancedObject(text, i)
    if (!found) continue
    const block = extractToolFromObject(found.value)
    if (block && isAllowedToolName(block.name, allowedNames)) blocks.push(block)
    i = found.end - 1
  }
  return blocks
}

/** 收集明确 XML 标签中的工具调用（不限定外层包裹标签名，兼容 camelCase 与任意命名） */
function collectTaggedTools(
  text: string,
  allowedNames?: ReadonlySet<string> | null,
): PlainTextToolCallBlock[] {
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
    // 提供了白名单时进一步要求名字确实在生效工具集里，堵住"名字长得像命令但其实是
    // 文档示例"的漏网情况。
    if (!isAllowedToolName(name, allowedNames)) continue
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

/**
 * 收集「外层标签即工具名」形态的调用：`<list_dir><path>D:\KX2API\build</path></list_dir>`。
 *
 * 某些模型按自己记忆/习惯，直接拿工具名当 XML 外层标签，参数以子标签形式平铺在内。
 * 这与默认形态（外层 `<tool_call>` 容器 + 内层 `<toolName>` + `<arguments>`）正好相反，
 * 既有的 collectTaggedTools / collectFlatXmlTools 都用「name 子标签」来定位工具名，
 * 对这种「外层即工具名」的形态完全解析不到 —— 这正是 `<list_dir>` 起不到的根因之一。
 *
 * 判定（三重收紧，避免把文档正文里的 HTML 标签误当工具）：
 *   1. 外包标签名必须能通过 isAllowedToolName（含别名兜底，list_dir→ls 也放行）；
 *   2. 内层必须至少有一个「参数子标签」（形如 <key>value</key>）—— 无参数的
 *      `<div></div>`、纯文本 `<p>你好</p>` 不算；
 *   3. 内层子标签名排除 name/tool/fn 这类「工具名声明」（那种走 collectTaggedTools）。
 */
function collectOuterTagAsTool(
  text: string,
  allowedNames?: ReadonlySet<string> | null,
): PlainTextToolCallBlock[] {
  const blocks: PlainTextToolCallBlock[] = []
  const OUTER_TAG_RE = /<([a-zA-Z_][\w:\-]*)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi
  let m: RegExpExecArray | null
  while ((m = OUTER_TAG_RE.exec(text)) !== null) {
    const tagName = m[1].trim()
    const inner = m[2]
    // 外层标签必须是合法命令名（含别名兜底）；非命令名（<html>、<document>）跳过
    if (!isAllowedToolName(tagName, allowedNames)) continue
    // 内层必须至少有一个「参数子标签」，否则视为空容器/纯文本标签
    const CHILD_RE = /<\s*([a-zA-Z_][\w-]*)\b[^>]*>([\s\S]*?)<\s*\/\s*\1\s*>/gi
    let childSeen = false
    const obj: Record<string, unknown> = {}
    let cm: RegExpExecArray | null
    CHILD_RE.lastIndex = 0
    while ((cm = CHILD_RE.exec(inner)) !== null) {
      const key = cm[1].trim()
      const val = cm[2].trim()
      if (!key) continue
      // 跳过 name 类标签：那是 collectTaggedTools 的专责
      if (/^(name|toolName|tool_name|tool|fn|function)$/i.test(key)) continue
      childSeen = true
      obj[key] = val
    }
    if (!childSeen || Object.keys(obj).length === 0) continue
    blocks.push({ name: tagName, arguments: obj })
  }
  return blocks
}

/** 收集代码围栏内的 JSON 工具调用 */
function collectFencedJson(
  text: string,
  allowedNames?: ReadonlySet<string> | null,
): PlainTextToolCallBlock[] {
  const blocks: PlainTextToolCallBlock[] = []
  FENCED_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = FENCED_RE.exec(text)) !== null) {
    const body = m[1]
    if (!body || !body.includes('{')) continue
    for (const b of scanJsonObjects(body, allowedNames)) blocks.push(b)
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
function collectFlatXmlTools(
  text: string,
  allowedNames?: ReadonlySet<string> | null,
): PlainTextToolCallBlock[] {
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
    // 误判保护：非法命令标识符（含空格/中文/纯数字等）不认定，保护正文；
    // 提供白名单时还要求名字在生效工具集内
    if (!isAllowedToolName(name, allowedNames)) continue
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
export function parsePlainTextToolCalls(
  text: string,
  allowedNames?: ReadonlySet<string> | null,
): PlainTextToolCallBlock[] | null {
  if (!text || typeof text !== 'string') return null

  const tagged = collectTaggedTools(text, allowedNames)
  if (tagged.length > 0) return tagged

  // 外层标签即工具名（<list_dir><path>...</path></list_dir>）
  const outerTag = collectOuterTagAsTool(text, allowedNames)
  if (outerTag.length > 0) return outerTag

  // 扁平 XML 工具调用（无外层包裹、camelCase 子标签）
  const flatXml = collectFlatXmlTools(text, allowedNames)
  if (flatXml.length > 0) return flatXml

  const jsonBlocks = scanJsonObjects(text, allowedNames)
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
export function extractPlainTextToolCalls(
  text: string,
  allowedNames?: ReadonlySet<string> | null,
): PlainTextToolCallBlock[] {
  if (!text || typeof text !== 'string') return []

  const tagged = collectTaggedTools(text, allowedNames)
  if (tagged.length > 0) return tagged

  // 外层标签即工具名（<list_dir><path>...</path></list_dir>）
  const outerTag = collectOuterTagAsTool(text, allowedNames)
  if (outerTag.length > 0) return outerTag

  const flatXml = collectFlatXmlTools(text, allowedNames)
  if (flatXml.length > 0) return flatXml

  const fenced = collectFencedJson(text, allowedNames)
  if (fenced.length > 0) return fenced

  return scanJsonObjects(text, allowedNames)
}

/** 响应包标识：#### 响应包 / ###响应包 / 响应包： 等变体 */
const RESPONSE_SECTION_RE = /(?:#{2,6}\s*)?响应包\s*[:：]?\s*$/i

/**
 * 从文本中剥离工具调用块，返回清理后的纯文本内容。
 * 工具调用（请求包）整段移除；响应包数据折叠为占位符，避免正文过长。
 */
export function stripPlainTextToolCalls(
  text: string,
  allowedNames?: ReadonlySet<string> | null,
): string {
  if (!text || typeof text !== 'string') return ''

  // 剥离「含工具名声明的任意 XML 元素」：兼容 <toolCall> / <ToolCall> / <tool_call> 及扁平形态。
  //
  // ⚠️ 这是数据丢失风险最高的一处：正则匹配「任意标签名」，只要内里出现
  // <name>...</name> 就整段移除。接口文档/HTML 示例里的
  // `<response><name>用户</name></response>` 会因此被静默删掉。
  // 提供白名单时，只有名字确实命中生效工具集才剥离；未提供时保持原行为。
  let cleaned = text
  const STRIP_XML_EL_RE = /<([a-zA-Z_][\w:\-]*)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi
  cleaned = cleaned.replace(STRIP_XML_EL_RE, (full: string, _tag: string, inner: string) => {
    const nameTag = inner.match(TOOL_NAME_SUBTAG_RE)
    if (!nameTag) return full
    if (!allowedNames || allowedNames.size === 0) return ''
    const name = nameTag[1].replace(/<[^>]*>/g, '').trim()
    return isAllowedToolName(name, allowedNames) ? '' : full
  })

  // 剥离「外层标签即工具名」形态：`<list_dir><path>…</path></list_dir>`。
  //
  // ⚠️ 此形态与 collectOuterTagAsTool 识别集一致，但剥离必须比识别**更严**：
  // 识别阶段放宽没问题（顶多多识别一个成功执行），剥离若宽就会把「举例正文」里
  // 的 `<list_dir>…`（如“我推荐用 <list_dir> 思路”）整段误删，正文静默丢失。
  // 因此这里额外要求：该调用块**独立成行/前后只有空白**才算工具调用，且块内
  // 必须是纯参数子标签（无中英文正文骨架）。这样反代/直连模式下“整段纯工具
  // 输出”会被清干净，而夹在句子里的 `<list_dir>` 举例文字原样保留。
  const OUTER_STRIP_RE =
    /^[ \t]*<([a-zA-Z_][\w:\-]*)\b[^>]*>([\s\S]*?)<\/\1\s*>[ \t]*$/gm
  cleaned = cleaned.replace(OUTER_STRIP_RE, (full: string, _tag: string, inner: string) => {
    if (!allowedNames || allowedNames.size === 0) return full
    // 外层标签必须是合法命令名（含别名兜底）
    const tag = _tag.trim()
    if (!isAllowedToolName(tag, allowedNames)) return full
    // 内层必须全是参数子标签：先剥出全部 key，再检查没有“可懂正文”残留
    const CHILD_RE = /<\s*([a-zA-Z_][\w-]*)\b[^>]*>([\s\S]*?)<\s*\/\s*\1\s*>/gi
    let c: RegExpExecArray | null
    CHILD_RE.lastIndex = 0
    let keys = 0
    while ((c = CHILD_RE.exec(inner)) !== null) {
      const k = c[1].trim()
      if (/^(name|toolName|tool_name|tool|fn|function)$/i.test(k)) return full
      keys++
    }
    if (keys === 0) return full
    // 子标签之外的残留必须只是空白（不能有“我推荐用”这类正文骨架）
    const leftover = inner.replace(CHILD_RE, '').trim()
    if (leftover) return full
    return ''
  })

  // 剥离扁平 XML 工具调用（无外层包裹）：<toolName>..</toolName> 与紧随的 <arguments>..</arguments>
  // 标签集必须与 collectFlatXmlTools 保持一致（不含裸 name —— 裸 <name> 极易与正文/文档误判），
  // 否则会出现「识别集合」与「剥离集合」不一致：要么工具卡片残留、要么正文被误删。
  const FLAT_STRIP_RE =
    /<\s*(toolName|tool_name|toolname|tool|fn)\b[^>]*>\s*([\s\S]*?)\s*<\/\s*(?:toolName|tool_name|toolname|tool|fn)\s*>(?:\s*<\s*arguments?\b[^>]*>[\s\S]*?<\/\s*arguments?\s*>)?/gi
  cleaned = cleaned.replace(FLAT_STRIP_RE, (full: string, _tag: string, inner: string) => {
    if (!allowedNames || allowedNames.size === 0) return ''
    const name = String(inner).replace(/<[^>]*>/g, '').trim()
    return isAllowedToolName(name, allowedNames) ? '' : full
  })

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
