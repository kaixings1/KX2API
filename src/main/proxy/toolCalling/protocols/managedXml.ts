import type { ToolProtocolAdapter } from './base.ts'
import type { ToolParseContext } from '../types.ts'
import {
  addParameter,
  buildToolCall,
  createParseResult,
  decodeXml,
  detectMarkers,
  escapeXmlAttribute,
  normalizeToolName,
  parseJsonValue,
  readBalancedJson,
  renderToolList,
  repairToolArguments,
  stripFencedCodeBlocks,
  toolNames,
} from './shared.ts'

const PROTOCOL_PREFIX = 'KX2API'
const KX2API_START = '<|' + PROTOCOL_PREFIX + '|tool_calls>'
const KX2API_END = '</|' + PROTOCOL_PREFIX + '|tool_calls>'

const XML_START = '<|' + PROTOCOL_PREFIX + '|' 
export { PROTOCOL_PREFIX }

const SURGE_START = '<tool_call>'
// GLM 网页版 Anthropic 风格命名空间起始标记（<antml:tool_calls> 或任意 a-z: 前缀）
const ANTML_START = '<antml:'
// TOOL_NAME_MAPPING, normalizeToolName, readBalancedJson → ./shared.ts

/**
 * Default allowed tool-name set.
 *
 * When the client does NOT send an explicit OpenAI `tools` array (e.g. a plain
 * natural-language instruction such as "列出 src/"), `context.tools` is empty,
 * so `toolNames(context.tools)` yields an EMPTY set. The original parser then
 * treated every tool name as invalid (`!allowedNames.has(name)` → skip), which
 * is exactly why no tool could ever be extracted from the website's response.
 *
 * This fallback set lets the parser accept the platform's well-known native
 * tool names even when the request carried no tool declaration. Extend it as
 * new provider-native tools are discovered — do NOT remove existing entries.
 */
export const DEFAULT_ALLOWED_NAMES: Set<string> = new Set<string>([
  // ── Generic filesystem / shell / search (GLM, StepFun, Kimi, Qwen, ...) ──
  'read_file',
  'Read',
  'list_dir',
  'ListFiles',
  'write_file',
  'Write',
  'edit',
  'Edit',
  'search_content',
  'Grep',
  'glob',
  'Glob',
  'find',
  'execute_command',
  'Bash',
  'cmd',
  'shell',
  'powershell',
  'batch',
  // ── Web ──
  'web_search',
  'WebSearch',
  'fetch_url',
  'WebExtractor',
  // ── Code / image ──
  'execute_code',
  'CodeInterpreter',
  'generate_image',
  // ── GLM / StepFun common native names (observed in captured responses) ──
  'list_directory',
  'read_file_content',
  'write_to_file',
  'replace_in_file',
  'run_command',
  'run_code',
  'search_files',
  'websearch',
  'image_gen',
])

/**
 * Parse the bracket format used by GLM (and several other web assistants):
 *
 *   [function_calls]
 *   [call:exact_tool_name]{"arg": "value"}[/call]
 *   [call:other]{...}[/call]
 *   [/function_calls]
 *
 * Also tolerates a missing opening bracket (`function_calls]`) and unclosed
 * blocks (streaming / malformed output). Mirrors the proven GLM branch in
 * utils/toolParser.ts.
 */
function parseBracketFormat(
  content: string,
  options: {
    rawMatches: string[]
    invalidToolNames: string[]
    allowedNames: Set<string>
    toolCalls: ReturnType<typeof buildToolCall>[]
  },
): void {
  const hasFunctionCalls =
    content.includes('[function_calls]') ||
    content.includes('function_calls]') ||
    /\[call[:=]/.test(content)
  if (!hasFunctionCalls) return

  // Prepend missing opening bracket for "text\nfunction_calls]" cases.
  let processed = content
  const missingBracket = /(^|[^\/\[])(function_calls\])/g
  if (!processed.includes('[function_calls]') && missingBracket.test(processed)) {
    processed = processed.replace(/(^|[^\/\[])(function_calls\])/g, '$1[$2')
  }

  const blockRegex = /\[function_calls\]([\s\S]*?)(?:\[\/function_calls\]|$)/g
  let blockMatch: RegExpExecArray | null
  while ((blockMatch = blockRegex.exec(processed)) !== null) {
    const blockContent = blockMatch[1]
    options.rawMatches.push(blockMatch[0])

    const callRegex = /\[call\s*[:=]?\s*([a-zA-Z0-9_:-]+)\]([\s\S]*?)\[\/call\]/g
    let match: RegExpExecArray | null
    while ((match = callRegex.exec(blockContent)) !== null) {
      // const/let/var 声明行内的 [call:name]{...} 绝不可能是真实工具调用
      // （如讲解源码里的 `const x = '[call:Read]{...}'`）。
      if (isInConstDeclaration(blockContent, match.index)) continue

      const functionName = match[1].trim()
      const normalizedName = normalizeToolName(functionName)
      if (!options.allowedNames.has(normalizedName)) {
        options.invalidToolNames.push(functionName)
        continue
      }

      let argumentsStr = (match[2] || '').trim()
      if (argumentsStr.startsWith('```') && argumentsStr.endsWith('```')) {
        argumentsStr = argumentsStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
      }

      let parsed: unknown = null
      try {
        parsed = JSON.parse(argumentsStr)
      } catch {
        // Fallback: fix single-quoted / unquoted keys.
        try {
          parsed = JSON.parse(
            argumentsStr
              .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
              .replace(/'/g, '"'),
          )
        } catch {
          parsed = null
        }
      }

      if (parsed === null) continue

      options.toolCalls.push(
        buildToolCall(
          `call_${options.toolCalls.length}`,
          options.toolCalls.length,
          normalizedName,
          JSON.stringify(parsed),
          match[0],
        ),
      )
    }
  }
}

export const managedXmlProtocol: ToolProtocolAdapter = {
  id: 'managed_xml',

  renderPrompt(tools) {
    return `## IMPORTANT: You are a tool-using assistant. You MUST use tools for all actions. NEVER respond with plain text describing what you will do.

## Available Tools
You can invoke the following developer tools. Tool names are case-sensitive.
Use only the exact tool names listed below. Do not rename, camelCase, translate, shorten, or invent tool names.

${renderToolList(tools)}

## How to Call Tools
When you need to perform any action (reading files, running commands, searching, writing, editing, etc.), IMMEDIATELY output the tool call block below. Do NOT say "I will do X" or "Let me check" — just call the tool directly.

<|${PROTOCOL_PREFIX}|tool_calls><|${PROTOCOL_PREFIX}|invoke name="exact_tool_name"><|${PROTOCOL_PREFIX}|parameter name="argument"><![CDATA[value]]></|${PROTOCOL_PREFIX}|parameter></|${PROTOCOL_PREFIX}|invoke></|${PROTOCOL_PREFIX}|tool_calls>

## CRITICAL RULES:
- NEVER output plain text before or after a tool call block. No explanations, no "I'll help you with that", no "Let me check".
- When a tool is needed, your ENTIRE response must be ONLY the tool call XML block above — nothing else.
- Call ONLY ONE tool per response.
- NEVER nest <|${PROTOCOL_PREFIX}|invoke> tags inside another <|${PROTOCOL_PREFIX}|invoke>. Each invoke must be standalone.
- Each tool call must have its own complete XML block with properly matched opening and closing tags.
- If you need to call multiple tools, make one call, wait for the result, then make the next call.

## Tool Results
After a tool call, you will receive the result in this format:
<|${PROTOCOL_PREFIX}|tool_result tool_call_id="call_id"><![CDATA[result]]></|${PROTOCOL_PREFIX}|tool_result>

Use the result to continue your work, calling more tools as needed.`
  },

  detectStart(buffer) {
    return detectMarkers(buffer, [KX2API_START, XML_START, SURGE_START, ANTML_START])
  },

  parse(content: string, context: ToolParseContext) {
    // GLM 网页版常把 `<` `>` `&` `"` 写成 Unicode 转义（\u003c \u003e \u0026 \u0022），
    // 若不在解析前反转义，所有 <tool_call> 字面正则都匹配不到，导致真实工具漏提。
    const decoded = content
      .replace(/\\u003c/gi, '<')
      .replace(/\\u003e/gi, '>')
      .replace(/\\u0026/gi, '&')
      .replace(/\\u0022/gi, '"')
    // 剥离注释行（// 开头）与块注释（/* */），避免讲解/源码里的 <tool_call> 被误提
    const commented = stripComments(decoded)
    // 预处理：剥掉 Markdown 代码块（已由 stripFencedCodeBlocks 处理）+ Markdown 表格行
    // + 行内代码跨度（`...`）。GLM 在讲解工具格式时，会把各种格式示例写成
    // `| <tool_call>... | ... |` 表格行或 `<tool_call>{json}</tool_call>` 行内代码，
    // 这些并非真实工具调用，必须排除，否则会误提取（且提取不出真实命令行参数）。
    // ── 前置步骤：GLM 网页版常把"标准 OpenAI 工具调用 JSON 数组"包在代码块里
    // 下发，而 stripFencedCodeBlocks 会无脑删除整个代码块，导致真实工具漏提。
    // 故在删除代码块之前，先扫描代码块提取合法工具数组（见 extractFencedJsonToolCalls）。
    const declaredNames = toolNames(context.tools)
    const allowedNames = declaredNames.size > 0 ? declaredNames : DEFAULT_ALLOWED_NAMES
    const rawMatches: string[] = []
    const invalidToolNames: string[] = []
    const toolCalls = []

    extractFencedJsonToolCalls(commented, { rawMatches, invalidToolNames, allowedNames, toolCalls })
    // 兼容上游网页仍使用旧前缀 CHAT2API 的情况：统一替换为 KX2API 后解析
    const normalized = commented.replace(/<\|CHAT2API\|/g, '<|KX2API|>')
    const parseable = stripNonToolLines(stripDocExampleNoise(stripFencedCodeBlocks(normalized)))
    parseBlocks(parseable, {
      blockPattern: new RegExp('<\\|' + PROTOCOL_PREFIX + '\\|tool_calls>([\\s\\S]*?)<\\/\\|' + PROTOCOL_PREFIX + '\\|tool_calls>', 'g'),
      invokePattern: new RegExp('<\\|' + PROTOCOL_PREFIX + '\\|invoke\\s+name="([^"]+)"\\s*>([\\s\\S]*?)<\\/\\|' + PROTOCOL_PREFIX + '\\|invoke>', 'g'),
      parameterPattern: new RegExp('<\\|' + PROTOCOL_PREFIX + '\\|parameter\\s+name="([^"]+)"\\s*>([\\s\\S]*?)<\\/\\|' + PROTOCOL_PREFIX + '\\|parameter>', 'g'),
      rawMatches,
      invalidToolNames,
      allowedNames,
      toolCalls,
    })

    parseBlocks(parseable, {
      blockPattern: /<tool_calls>([\s\S]*?)<\/tool_calls>/g,
      invokePattern: /<invoke\s+name="([^"]+)"\s*>([\s\S]*?)<\/invoke>/g,
      parameterPattern: /<parameter\s+name="([^"]+)"\s*>([\s\S]*?)<\/parameter>/g,
      rawMatches,
      invalidToolNames,
      allowedNames,
      toolCalls,
    })

    // Surge/Claude XML 子标签变体：<tool_call><toolName>X</toolName><arguments>...</arguments></tool_call>
    // 必须放在 parseSurgeFormat 之前解析——parseSurgeFormat 会把 <toolName> 误当工具名
    // 并过早 push 到 rawMatches，导致本分支的 isCovered 判重失效而漏提。
    parseToolNameSubtagFormat(parseable, {
      rawMatches,
      invalidToolNames,
      allowedNames,
      toolCalls,
    })

    parseSurgeFormat(parseable, {
      rawMatches,
      invalidToolNames,
      allowedNames,
      toolCalls,
    })

    // GLM / web-assistant bracket format: [function_calls]...[call:name]{json}[/call]
    parseBracketFormat(parseable, {
      rawMatches,
      invalidToolNames,
      allowedNames,
      toolCalls,
    })

    // GLM 强制 function-calling 模式：<tool_call>NAME ... <<HEREDOC {OpenAI JSON} HEREDOC
    parseHeredocJsonFormat(parseable, {
      rawMatches,
      invalidToolNames,
      allowedNames,
      toolCalls,
    })

    // GLM 变体：<tool_call>NAME->ALIAS->{JSON}({JSON});
    parseArrowFormat(parseable, {
      rawMatches,
      invalidToolNames,
      allowedNames,
      toolCalls,
    })

    // GLM 网页版：<tool_calls>[{OpenAI tool_calls JSON 数组}]</tool_calls>
    parseToolCallsArrayFormat(parseable, {
      rawMatches,
      invalidToolNames,
      allowedNames,
      toolCalls,
    })

    // GLM 网页版 Anthropic 风格命名空间：<antml:tool_calls><antml:tool_call
    // name="Bash"><antml:parameter name="command" type="string">cat '...'</antml:parameter>
    // </antml:tool_call></antml:tool_calls>。参数值常被包一层单/双引号，需剥除。
    parseAntmlFormat(parseable, {
      rawMatches,
      invalidToolNames,
      allowedNames,
      toolCalls,
    })

    if (toolCalls.length === 0) {
      // ── 调试日志：把解析结果（含原始匹配/无效工具名）输出到控制台 ──
      console.log(
        '[managedXml:parse] NO_TOOL_CALLS ' +
          JSON.stringify({
            protocol: rawMatches.length > 0 ? 'managed_xml' : 'unknown',
            rawMatches,
            invalidToolNames,
            contentLen: content.length,
          }),
      )
      return createParseResult({
        content,
        toolCalls,
        protocol: rawMatches.length > 0 ? 'managed_xml' : 'unknown',
        rawMatches,
        invalidToolNames,
      })
    }

    // ── 调试日志：把最终发给客户端的工具调用数据包（含临时主动生成的 call_*）输出到控制台 ──
    console.log(
      '[managedXml:parse] TOOL_CALLS_PACKET ' +
        JSON.stringify({
          protocol: 'managed_xml',
          toolCalls: toolCalls.map((c) => ({
            id: c.id,
            index: c.index,
            name: c.name,
            arguments: c.arguments,
            raw: c.raw,
          })),
          rawMatches,
          invalidToolNames,
        }),
    )
    // Repair extracted arguments: key normalize + type coerce + inject defaults
    if (toolCalls.length > 0) {
      const repairedArgs = repairToolArguments(
        toolCalls.reduce((acc, tc) => {
          try { acc[tc.id] = JSON.parse(tc.function.arguments) } catch { acc[tc.id] = {} }
          return acc
        }, {} as Record<string, Record<string, unknown>>),
        context.tools,
      )
      for (const tc of toolCalls) {
        const repaired = repairedArgs[tc.id]
        if (repaired !== null && repaired !== void 0) {
          tc.function.arguments = JSON.stringify(repaired)
        }
      }
    }

    return createParseResult({
      content: parseable.trim(),
      toolCalls,
      protocol: 'managed_xml',
      rawMatches,
      invalidToolNames,
    })
  },

  formatAssistantToolCalls(calls) {
    const invokes = calls.map((call) => {
      const args = safeParseObject(call.arguments)
      const params = Object.entries(args)
        .map(([name, value]) => {
          const text = typeof value === 'string' ? value : JSON.stringify(value)
          return `<|${PROTOCOL_PREFIX}|parameter name="${escapeXmlAttribute(name)}"><![CDATA[${text}]]></|${PROTOCOL_PREFIX}|parameter>`
        })
        .join('')
      return `<|${PROTOCOL_PREFIX}|invoke name="${escapeXmlAttribute(call.name)}">${params}</|${PROTOCOL_PREFIX}|invoke>`
    })
    return `${KX2API_START}${invokes.join('')}${KX2API_END}`
  },

  formatToolResult(result) {
    return `<|${PROTOCOL_PREFIX}|tool_result tool_call_id="${escapeXmlAttribute(result.toolCallId)}"><![CDATA[${result.content}]]></|${PROTOCOL_PREFIX}|tool_result>`
  },
}

interface ParseBlockOptions {
  blockPattern: RegExp
  invokePattern: RegExp
  parameterPattern: RegExp
  rawMatches: string[]
  invalidToolNames: string[]
  allowedNames: Set<string>
  toolCalls: ReturnType<typeof buildToolCall>[]
}

function parseBlocks(content: string, options: ParseBlockOptions): void {
  let blockMatch: RegExpExecArray | null

  while ((blockMatch = options.blockPattern.exec(content)) !== null) {
    options.rawMatches.push(blockMatch[0])
    let invokeMatch: RegExpExecArray | null

    while ((invokeMatch = options.invokePattern.exec(blockMatch[1])) !== null) {
      // const/let/var 声明行内的 <|KX2API|invoke> 绝不可能是真实工具调用
      // （如 `const x = \`<|KX2API|invoke name="Read">...\`` 这类讲解/源码示例），
      // 必须排除，否则会把源码里的工具标记误提取为真实工具。
      if (isInConstDeclaration(blockMatch[1], invokeMatch.index)) continue

      const name = invokeMatch[1].trim()
      if (!options.allowedNames.has(name)) {
        options.invalidToolNames.push(name)
        continue
      }

      const args: Record<string, unknown> = {}
      let parameterMatch: RegExpExecArray | null
      options.parameterPattern.lastIndex = 0
      while ((parameterMatch = options.parameterPattern.exec(invokeMatch[2])) !== null) {
        addParameter(args, parameterMatch[1].trim(), parseJsonValue(parameterMatch[2]))
      }

      options.toolCalls.push(
        buildToolCall(`call_${options.toolCalls.length}`, options.toolCalls.length, name, JSON.stringify(args), invokeMatch[0]),
      )
    }
  }
}

function safeParseObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

// ── GLM 变体：<tool_call>NAME->ALIAS->{JSON}({JSON}); ──
// 例：
//   <tool_call>BashTool->Bash->{"command": "cat '...'"}({"cmd": "cat '...'"});
//   <tool_call>Read->read_file->{"target_file": "..."}({"target_file": "..."});
// 用 "->" 分隔 工具名->别名->，后跟 {json} 参数，再可选 ({json}) 第二份参数，以 ";" 结尾。
/**
 * 解析箭头格式的参数。
 *
 * 形如 `<tool_call>NAME->ALIAS->{...}` 或 `<tool_call>NAME->ALIAS->{...}({...});`
 * —— 第二个对象是可选的补充参数，两者合并（后者覆盖同名字段）。
 *
 * 注：本函数此前**从未定义**，而 parseArrowFormat 里两处调用它 ——
 * 一旦走到那两个分支就是 ReferenceError。因该格式不是主路径（只在
 * 特定客户端出现），一直没暴露；但属必崩死角，此处补上。
 */
function extractArrowArgs(
  primary: string | void,
  extra: string | void,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const merge = (raw: string | void): void => {
    if (!raw) return
    const parsed = safeParseObject(raw)
    for (const [k, v] of Object.entries(parsed)) out[k] = v
  }
  merge(primary)
  merge(extra)
  return out
}

function parseArrowFormat(content: string, options: {
  rawMatches: string[]
  invalidToolNames: string[]
  allowedNames: Set<string>
  toolCalls: ReturnType<typeof buildToolCall>[]
}): void {
  // 匹配 <tool_call>NAME->ALIAS->{...} 或 <tool_call>NAME->ALIAS->{...}({...});
  const arrowRegex = /<tool_call>\s*([A-Za-z_][\w.]*)\s*->\s*([A-Za-z_]\w*)\s*->\s*(\{[\s\S]*?\})(?:\s*\(\s*(\{[\s\S]*?\})\s*\))?\s*;?/gi
  let match: RegExpExecArray | null
  while ((match = arrowRegex.exec(content)) !== null) {
    const isCovered = options.rawMatches.some((existing) => {
      const idx = existing.indexOf(match[0])
      if (idx === -1) return false
      return match.index >= idx && match.index < idx + existing.length
    })
    if (isCovered) continue

    options.rawMatches.push(match[0])
    const rawName = match[1].trim()
    // 优先用别名（ALIAS，如 Bash/Read）做归一化，更贴近客户端工具名
    const aliasName = match[2].trim()
    const tryName = aliasName || rawName
    const normalizedName = normalizeToolName(tryName)
    if (!options.allowedNames.has(normalizedName)) {
      // 别名不在白名单时再试原始名
      const normalizedRaw = normalizeToolName(rawName)
      if (options.allowedNames.has(normalizedRaw)) {
        options.toolCalls.push(
          buildToolCall(`call_${options.toolCalls.length}`, options.toolCalls.length, normalizedRaw, extractArrowArgs(match[3], match[4]), match[0]),
        )
        continue
      }
      options.invalidToolNames.push(tryName)
      continue
    }

    options.toolCalls.push(
      buildToolCall(`call_${options.toolCalls.length}`, options.toolCalls.length, normalizedName, extractArrowArgs(match[3], match[4]), match[0]),
    )
  }
}


/**
 * GLM 网页版常把"标准 OpenAI 工具调用 JSON 数组"包在 ``` 代码块里下发，例如：
 *   ```json
 *   [
 *     { "name": "Bash", "arguments": "{\"command\": \"cat D:\\...\\managedXml.ts\"}" }
 *   ]
 *   ```
 * 而 stripFencedCodeBlocks 会无脑删除整个代码块，导致真实工具漏提。本函数在删除
 * 代码块之前，先扫描所有 ``` 代码块，对内容为合法"工具数组 JSON"的优先提取为
 * tool_calls；解析失败的代码块（纯讲解/示例）则不处理，留给后续删除/保留逻辑，
 * 不影响讲解示例原样输出。
 */
function extractFencedJsonToolCalls(
	content: string,
	options: {
		rawMatches: string[]
		invalidToolNames: string[]
		allowedNames: Set<string>
		toolCalls: ReturnType<typeof buildToolCall>[]
	},
): void {
	const fencePattern = new RegExp('```(?:json)?[\\\\s\\\\S]*?```', 'gi')
	let fenceMatch: RegExpExecArray | null
	while ((fenceMatch = fencePattern.exec(content)) !== null) {
		const rawBlock = fenceMatch[0] as string
		const inner = rawBlock.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
		if (!inner) continue
		let parsed: any = null
		try {
			parsed = JSON.parse(inner)
		} catch {
			continue
		}
		if (!Array.isArray(parsed) || parsed.length === 0) continue
		let okArray = true
		for (const c of parsed) {
			const fn = c && c.function ? c.function : c
			const hasName = typeof fn.name === 'string' || typeof c.name === 'string'
			const hasArgs = (fn && fn.arguments !== undefined) || c.arguments !== undefined
			if (!hasName) okArray = false
			if (!hasArgs) okArray = false
		}
		if (!okArray) continue
		options.rawMatches.push(rawBlock)
		for (const call of parsed) {
			const fn = call && call.function ? call.function : call
			const rawName = (fn && fn.name) ? fn.name : call.name
			if (!rawName) continue
			const normalizedName = normalizeToolName(String(rawName))
			if (!options.allowedNames.has(normalizedName)) {
				options.invalidToolNames.push(String(rawName))
				continue
			}
			let argsStr: string
			if (typeof fn.arguments === 'string') argsStr = fn.arguments
			else if (fn.arguments && typeof fn.arguments === 'object') argsStr = JSON.stringify(fn.arguments)
			else if (call.arguments && typeof call.arguments === 'object') argsStr = JSON.stringify(call.arguments)
			else argsStr = '{}'
			if (looksLikeSourceCode(argsStr)) {
				options.invalidToolNames.push(String(rawName))
				continue
			}
			if (toolNeedsFile(normalizedName) && !hasFilePathValue(argsStr)) {
				options.invalidToolNames.push(String(rawName))
				continue
			}
			options.toolCalls.push(
				buildToolCall('call_' + options.toolCalls.length, options.toolCalls.length, normalizedName, argsStr,
rawBlock),
			)
		}
	}
}
	 

// ── GLM 网页版：<tool_calls>[{OpenAI tool_calls JSON 数组}]</tool_calls> ──
// 例：
//   <tool_calls>
//   [{"name": "Read", "arguments": "{\"filepath\": \"...\"}"}]
//   </tool_calls>
// GLM 网页版在强制 function-calling 时，会把标准 OpenAI tool_calls JSON 数组
// 直接包进 <tool_calls>...</tool_calls> 标签里输出。这与 parseBlocks 期望的
// <invoke name="..."> 子标签格式、parseSurgeFormat 期望的 <tool_call>NAME 格式
// 都不同，必须单独分支提取 function.name / function.arguments。
function parseToolCallsArrayFormat(content: string, options: {
  rawMatches: string[]
  invalidToolNames: string[]
  allowedNames: Set<string>
  toolCalls: ReturnType<typeof buildToolCall>[]
}): void {
  const arrayRegex = /<tool_calls>\s*(\[[\s\S]*?\])\s*<\/tool_calls>/gi
  let match: RegExpExecArray | null
  while ((match = arrayRegex.exec(content)) !== null) {
    const jsonText = match[1].trim()
    let parsed: any = null
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      const balanced = readBalancedJson(jsonText, 0)
      if (balanced) {
        try { parsed = JSON.parse(balanced.json) } catch { parsed = null }
      }
    }
    if (!Array.isArray(parsed) || parsed.length === 0) continue

    const isCovered = options.rawMatches.some((existing) => {
      const idx = existing.indexOf(match[0])
      if (idx === -1) return false
      return match.index >= idx && match.index < idx + existing.length
    })
    if (isCovered) continue

    // const/let/var 声明行内的 <tool_calls>[...] 绝不可能是真实工具调用
    // （如源码/讲解里的 `const x = \`<tool_calls>[{...}]\``）。
    if (isInConstDeclaration(content, match.index)) continue

    options.rawMatches.push(match[0])
    for (const call of parsed) {
      const fn = call?.function ?? call
      const rawName = fn?.name ?? call?.name
      if (!rawName) continue
      const normalizedName = normalizeToolName(String(rawName))
      if (!options.allowedNames.has(normalizedName)) {
        options.invalidToolNames.push(String(rawName))
        continue
      }
      let argsStr: string
      if (typeof fn?.arguments === 'string') argsStr = fn.arguments
      else if (fn?.arguments && typeof fn.arguments === 'object') argsStr = JSON.stringify(fn.arguments)
      else if (call?.arguments && typeof call.arguments === 'object') argsStr = JSON.stringify(call.arguments)
      else argsStr = '{}'
      // 排除源码/讲解误提取
      if (looksLikeSourceCode(argsStr)) {
        options.invalidToolNames.push(String(rawName))
        continue
      }
      // 需要文件的工具（Read/Write/Edit）若未提取到具体文件路径，视为误提取
      if (toolNeedsFile(normalizedName) && !hasFilePathValue(argsStr)) {
        options.invalidToolNames.push(String(rawName))
        continue
      }
      options.toolCalls.push(
        buildToolCall(`call_${options.toolCalls.length}`, options.toolCalls.length, normalizedName, argsStr, match[0]),
      )
    }
  }
}

// ── GLM 强制 function-calling 模式：<tool_call>NAME ... <<HEREDOC {OpenAI JSON} HEREDOC ──
// 例：
//   <tool_call>BashTool Buchanan bash Wolff <<"TOOL_CALL<
//   {
//     "tool_calls": [
//       { "type": "function", "function": { "name": "BashTool",
//         "arguments": "{\"action\":\"execute\",\"code\":\"cat '...'\"}" } }
//     ]
//   }
//   TOOL_CALL"
// GLM 在此模式下输出的是被 << heredoc 包裹的标准 OpenAI tool_calls JSON，
// 可直接提取 function.name / function.arguments，无需格式转换。
function parseHeredocJsonFormat(content: string, options: {
  rawMatches: string[]
  invalidToolNames: string[]
  allowedNames: Set<string>
  toolCalls: ReturnType<typeof buildToolCall>[]
}): void {
  // <tool_call> 后跟一个名字（可能含空格/杂物），再跟 << 分隔符，然后是 JSON。
  const heredocRegex = /<tool_call>([\s\S]*?)<<\s*["']?(\w+)["']?\s*\n([\s\S]*?)\n\s*\2["']?/gi
  let match: RegExpExecArray | null
  while ((match = heredocRegex.exec(content)) !== null) {
    const isCovered = options.rawMatches.some((existing) => {
      const idx = existing.indexOf(match[0])
      if (idx === -1) return false
      return match.index >= idx && match.index < idx + existing.length
    })
    if (isCovered) continue

    // const/let/var 声明行内的 <tool_call><<HEREDOC 绝不可能是真实工具调用
    // （如源码/讲解里的 `const x = \`<tool_call>Bash<<TOOL_CALL...\``）。
    if (isInConstDeclaration(content, match.index)) continue

    options.rawMatches.push(match[0])
    const jsonText = match[3].trim()

    let parsed: any = null
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      const brace = jsonText.indexOf('{')
      if (brace !== -1) {
        const balanced = readBalancedJson(jsonText, brace)
        if (balanced) {
          try { parsed = JSON.parse(balanced.json) } catch { parsed = null }
        }
      }
    }
    if (!parsed) continue

    const calls: any[] = Array.isArray(parsed) ? parsed : parsed.tool_calls ?? []
    if (!Array.isArray(calls) || calls.length === 0) continue

    for (const call of calls) {
      const fn = call?.function ?? call
      const rawName = fn?.name ?? call?.name
      if (!rawName) continue
      const normalizedName = normalizeToolName(String(rawName))
      if (!options.allowedNames.has(normalizedName)) {
        options.invalidToolNames.push(String(rawName))
        continue
      }
      let argsStr: string
      if (typeof fn?.arguments === 'string') {
        argsStr = fn.arguments
      } else if (fn?.arguments && typeof fn.arguments === 'object') {
        argsStr = JSON.stringify(fn.arguments)
      } else if (call?.arguments && typeof call.arguments === 'object') {
        argsStr = JSON.stringify(call.arguments)
      } else {
        argsStr = '{}'
      }
      // 排除源码/讲解误提取：参数像源码参数列表（逗号分隔多值）则跳过
      if (looksLikeSourceCode(argsStr)) {
        options.invalidToolNames.push(String(rawName))
        continue
      }
      // 需要文件的工具（Read/Write/Edit）若未提取到具体文件路径，视为误提取
      if (toolNeedsFile(normalizedName) && !hasFilePathValue(argsStr)) {
        options.invalidToolNames.push(String(rawName))
        continue
      }
      options.toolCalls.push(
        buildToolCall(`call_${options.toolCalls.length}`, options.toolCalls.length, normalizedName, argsStr, match[0]),
      )
    }
  }
}

/**
 * 剥离"文档示例噪声"：GLM 在讲解工具调用格式时，会把各种格式写成示例串。
 * 这些不是真实工具调用，且提取不出真实命令行参数，必须 neutral 化，否则会误提取
 * （甚至触发无效的 tool_calls，导致后续正文不被客户端显示）。
 *
 * 注意：表格行 / 注释行（// /* *）/ 纯代码行已由 parse() 层的 stripNonToolLines
 * 整行删除，不再需要在这里逐模式转义——那些行物理上不可能是真实工具调用。
 * 本函数只负责"夹在自然语言/行内代码里、无法整行删除"的标签转义：
 *   - 行内代码跨度 `...`（Markdown 代码样式，不能删整行，否则丢文字）
 *   - 行内直接出现的 <tool_call> 等裸标签（讲解正文里）
 * 统一用 escapeToolMarks 做 HTML 实体转义（< → &lt;），使后续 parseXxx 正则匹配不到。
 */
function stripDocExampleNoise(content: string): string {
  const escapeToolMarks = (s: string): string =>
    s
      .replace(/<(\/?)(tool_call|tool_calls|invoke|parameter)\b/gi, '&lt;$1$2')
      .replace(/<\|KX2API/gi, '&lt;|KX2API')
      .replace(/\[(function_calls|call:)/gi, '&#91;$1')

  // 行内代码跨度 `...`：常含 <tool_call>{json}</tool_call> 等示例。保留反引号与
  // 文字，仅把其中的工具标记做 HTML 实体转义，使示例不被误提、正文原样保留。
  let text = content.replace(/`([^`\n]*)`/gi, (full, inner) => {
    if (!/tool_call|tool_calls|function_calls|invoke|KX2API|\{json\}/i.test(inner)) return full
    return '`' + escapeToolMarks(inner) + '`'
  })

  // 行内直接出现的裸标签（讲解正文里，如 "注意 <tool_call>Bash..."）：整体转义。
  text = text.replace(/(^|[^&])<(tool_call|tool_calls|invoke|parameter)\b/gi, (m, p1) => p1 + '&lt;' + m.slice((p1 || '').length + 1))

  return text
}

/**
 * 剥离 Markdown 表格行。规则（对应需求"表格中的行绝对不可能是工具调用"）：
 *   - 行去缩进后以 `|` 开头（如 `| 解析器 | 格式 |`），整行删除；
 *   - 或行内含 `|` 列分隔且整体像表格行（至少两个 `|`、且含表头分隔 `---`），整行删除。
 * GLM 真实下发的工具调用是裸标签（<tool_calls>/<antml:...>/[function_calls] 等），
 * 物理上绝不会被包进 `| ... |` 表格语法。任何出现在表格行里的 <tool_call>/<antml:>
 * 都是"讲解/文件内容回显"，无论后续兜底怎么跑，都不应被当工具提取。
 * 故在喂给所有 parseXxx 分支前，把表格行整行剔除，彻底杜绝误提。
 */
function stripNonToolLines(text: string): string {
  return text
    .split('\n')
    .filter((line) => {
      const t = line.replace(/^\s+/, '')
      // 以 | 开头的表格行
      if (t.startsWith('|')) return false
      // 含表头分隔（|---|---|）的行
      if (/^\s*\|?[\s:|-]+\|[\s:|-]+\|?$/.test(line)) return false
      // 含至少两个 | 且整体像表格（非代码块内的 | 字符）
      const pipeCount = (line.match(/\|/g) || []).length
      if (pipeCount >= 2 && /^\s*\|.*\|/.test(line)) return false
      // 注释行：// 开头、/* 开头、* 续行 —— 绝不可能是工具调用
      if (t.startsWith('//')) return false
      if (t.startsWith('/*')) return false
      if (t.startsWith('*')) return false
      // 纯代码行：含源码特征（= ; {} () => 或 function/class/const/let/var/import/...）
      // 且无中文、无自然语言断句（逗号/句号+空格），且以标识符/引号/括号开头。
      // 正常工具/命令行都是单独一行出现的裸标签（<tool_calls>...），不会是缩进代码。
      const hasCodeMarks = /[=;{}()]|\=>|\b(function|class|const|let|var|import|export|return|if|for|while)\b/.test(line)
      const hasCJK = /[一-鿿]/.test(line)
      const looksLikeCode = hasCodeMarks && !hasCJK && !/[,，。；;]\s*\S/.test(line) && /^[\w$.'"[]/.test(t)
      if (looksLikeCode) return false
      return true
    })
    .join('\n')
}

/**
 * 剥离注释行/注释块。规则（对应需求"双 // 开头代表注释行，无论内容是什么都不
 * 提取工具"）：
 *   - 以 // 开头的行（去除前导空格后）整行删除
 *   - /* ... *\/ 块注释删除
 * 真实工具调用是独立的 <tool_call> 块，不会写成 // 注释行，故剥离安全且能彻底
 * 避免讲解/源码里的 <tool_call> 被误提。
 */
function stripComments(text: string): string {
  // 先删 /* ... */ 块注释（跨行）
  let t = text.replace(/\/\*[\s\S]*?\*\//g, ' ')
  // 再删 // 到行尾（行注释）。注意避免误删 http:// 等 URL 中的 //
  t = t
    .split('\n')
    .map((line) => {
      const trimmed = line.replace(/^\s+/, '')
      // 仅当整行（去空格后）以 // 开头，且不是 http:// / https:// 这类 URL 时才删
      if (trimmed.startsWith('//') && !/^https?:\/\//.test(trimmed)) return ''
      return line
    })
    .join('\n')
  return t
}

/**
 * 判断一段 inner 文本是否"看起来像源码/讲解"（而非真实工具调用参数）。
 * 真实工具调用的参数要么是子标签（<command>...</command>）、要么是单个 JSON
 * 对象，绝对不会是"逗号分隔的多个标识符/字面量"这种源码参数列表
 * （如 `options.toolCalls.length, normalizedName, argsJson, glmMatch[0]`）。
 * 命中则返回 true，解析器应跳过提取。
 */
function looksLikeSourceCode(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  // JSON 起始（真实工具参数）不当源码
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return false
  // ── 精准字符串判定：源码/解析器特有的标识符，命中即判为源码（弱但极准）──
  const SOURCE_MARKERS = [
    'toolCalls.length', 'glmMatch[0]', 'openMatch[0]', 'attrMatch[0]', 'dotMatch[0]',
    'buildToolCall(', 'normalizedName', 'argsJson', 'rawMatches.push',
    'options.toolCalls', 'createParseResult', 'addParameter(', 'readBalancedJson',
    'detectMarkers', 'toolStreamParser', 'createBaseChunk', 'baseChunk',
    'function normalizeToolName', 'TOOL_NAME_MAPPING', 'DEFAULT_ALLOWED_NAMES',
  ]
  if (SOURCE_MARKERS.some((m) => text.includes(m))) return true
  // 含函数调用 ident(...) → 源码
  if (/[A-Za-z_]\w*\s*\(/.test(trimmed)) return true
  // 逗号分隔的多个 token（>=2 个逗号，且逗号前后是标识符/数字/字符串）→ 源码参数列表
  const commaCount = (trimmed.match(/,/g) || []).length
  if (commaCount >= 2 && /[A-Za-z0-9_'"][)\]]?\s*,\s*[A-Za-z0-9_'"`]/i.test(trimmed)) {
    return true
  }
  return false
}

/**
 // * 判断 <tool_call> 是否位于"源码行"内——即其所在行（从 <tool_call> 往前到上一
 // * 个换行的前缀）去除前导空格后，以以下任一方式开头/包含，则绝不可能是真实工具
 // * 调用，直接当正文处理：
 // *   - `const ` / `let ` / `var `  ：变量声明（如 const regex = /<tool_call>.../gi）
 // *   - `const X =` / `let X =` 等带等号的赋值（如 const regex = /.../）
 // *   - `//`       ：行注释（如 // ── <tool_call>Bash command="ls -la"）
 // *   - `/*`       ：块注释起始
 // *   - `= /` 或 `= /` 形式的赋值+正则（如 regex = /<tool_call>.../）
 */
const IGNORED_XML_TAGS = new Set([
  'think', 'thinking', 'reflection', 'output', 'result', 'answer', 'response',
])

function isInConstDeclaration(content: string, index: number): boolean {
  const lineStart = content.lastIndexOf('\n', index - 1) + 1
  const linePrefix = content.slice(lineStart, index).replace(/^\s+/, '')
  if (/^const\s/.test(linePrefix)) return true
  if (/^let\s/.test(linePrefix)) return true
  if (/^var\s/.test(linePrefix)) return true
  if (linePrefix.startsWith('//')) return true
  if (linePrefix.startsWith('/*')) return true
  // 行前缀含 "名字 = /" 或 "名字 = {" 这类赋值（含 const/let/var 也覆盖）
  if (/(^|[\s;])(const|let|var)\s+[\w$]+\s*=/.test(linePrefix)) return true
  if (/=\s*\//.test(linePrefix)) return true
  // ── 嵌入叙述/讲解判定：<tool_call> 前后被空格包围、且并非紧贴标签边界 ──
  // 真实独立的工具调用块，<tool_call> 必在行首或紧跟另一标签（如 <invoke>），
  // 其紧前字符是行首或 '<'。若 <tool_call> 前有空白、且再往前一个非空白字符
  // 既不是 '<' 也不是行首（即它夹在"自然语言句子中间"，如 `查找 <tool_call> 开始标签`），
  // 则绝非真实工具调用，是讲解示例，直接当正文处理。
  // 同时：行首为 // 的注释行（如 `// 查找 <tool_call> 开始标签`）也已由上面
  // linePrefix.startsWith('//') 覆盖；此处再兜底"行内 // 注释后的 <tool_call>"。
  if (index > 0) {
    const prevChar = content[index - 1]
    if (/\s/.test(prevChar)) {
      // 往前找最近的非空白字符
      let j = index - 2
      while (j >= lineStart && /\s/.test(content[j])) j--
      // 非空白字符是 '<'（紧跟另一标签）或已到行首 → 视为合法边界
      const beforeNonWs = j >= lineStart ? content[j] : ''
      const embeddedInSentence = beforeNonWs !== '' && beforeNonWs !== '<'
      // 行内 // 注释后的情况：前缀（到行首）含 // 作为注释起始
      const lineHasComment = /(?:^|\s)\/\//.test(content.slice(lineStart, index))
      if (embeddedInSentence || lineHasComment) return true
    }
  }
  return false
}

/**
 * 需要"具体文件参数"的工具。Read/Write/Edit 几乎必然携带真实文件路径；
 * 若提取到的这类工具调用里没有任何像文件路径的参数，则视为误提取（讲解/
 * 示例），当作普通正文处理。列目录（ls/dir/ListFiles）、执行（Bash）、搜索
 * （WebSearch/Grep/Glob）等可无具体文件，不强制。
 */
function toolNeedsFile(name: string): boolean {
  const n = name.toLowerCase()
  return n === 'read' || n === 'write' || n === 'edit'
}

/** args 中是否含有"像文件路径"的值（盘符 / 路径分隔+扩展名 / 纯文件名带扩展名） */
function hasFilePathValue(args: unknown): boolean {
  const obj = typeof args === 'string' ? safeParseObj(args) : (args && typeof args === 'object' && !Array.isArray(args) ? (args as Record<string, unknown>) : null)
  if (!obj) return false
  for (const v of Object.values(obj)) {
    const s = typeof v === 'string' ? v : (typeof v === 'number' ? String(v) : '')
    if (!s) continue
    if (/^[A-Za-z]:[\\/]/.test(s)) return true
    if (/[/\\]/.test(s) && /\.\w{1,12}$/.test(s)) return true
    if (/\.\w{1,12}$/.test(s) && !s.includes(' ') && !s.includes(',')) return true
  }
  return false
}

function safeParseObj(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

// parseToolNameSubtagFormat 定义在本文件后部（先于 parseSurgeFormat 调用的注释处）。
// 此前这里曾有一份重复实现，已移除 —— 保留后部那份（含 decodeXml 与白名单双匹配，
// 比重复版本更完整）。

function parseSurgeFormat(content: string, options: {
  rawMatches: string[]
  invalidToolNames: string[]
  allowedNames: Set<string>
  toolCalls: ReturnType<typeof buildToolCall>[]
}): void {
  const pattern = /<tool_call>([\s\S]*?)<\/tool_call>/gi
  let match: RegExpExecArray | null

  while ((match = pattern.exec(content)) !== null) {
    // const 声明行内的 <tool_call> 绝不可能是真实工具
    if (isInConstDeclaration(content, match.index)) continue
    options.rawMatches.push(match[0])
    const inner = match[1].trim()

    let name = 'unknown'
    let args: unknown = {}

    // Try JSON first
    const jsonStart = inner.indexOf('{')
    if (jsonStart !== -1) {
      const balanced = readBalancedJson(inner, jsonStart)
      if (balanced) {
        try {
          const parsed = JSON.parse(balanced.json)
          if (parsed && typeof parsed === 'object') {
            name = parsed.name || parsed.tool || 'unknown'
            args = parsed.arguments ?? parsed.parameters ?? parsed
          }
        } catch { /* ignore */ }
      }
    }

    // If no name from JSON, try XML tag format
    if (name === 'unknown') {
      const xmlTag = /^<([a-zA-Z0-9_]+)>([\s\S]*)$/i.exec(inner)
      if (xmlTag) {
        name = xmlTag[1]
        const innerContent = xmlTag[2]
        // Try to parse as JSON
        const jsonStart2 = innerContent.indexOf('{')
        if (jsonStart2 !== -1) {
          const balanced = readBalancedJson(innerContent, jsonStart2)
          if (balanced) {
            try { args = JSON.parse(balanced.json) } catch { args = innerContent.trim() }
          } else {
            args = innerContent.trim()
          }
        } else {
          args = innerContent.trim()
        }
      }
    }

    const normalizedName = normalizeToolName(name)
    if (!options.allowedNames.has(normalizedName)) {
      options.invalidToolNames.push(name)
      continue
    }

    const argsJson = typeof args === 'string' ? args : JSON.stringify(args ?? {})
    // 排除 源 码  讲 解 误提 取：inner 像源码参数列表（逗号分隔多值）则跳过
    if (looksLikeSourceCode(inner)) {
      options.invalidToolNames.push(name)
      continue
    }
    // 需要文件的工具（Read/Write/Edit）若未提取到具体文件路径，视为误提取
    if (toolNeedsFile(normalizedName) && !hasFilePathValue(args)) {
      options.invalidToolNames.push(name)
      continue
    }
    options.toolCalls.push(
      buildToolCall(`call_${options.toolCalls.length}`, options.toolCalls.length, normalizedName, argsJson, match[0]),
    )
  }

  // ── 无闭合标签涌格式：<tool_call>ToolName: {JSON} ──
  const openPattern = /<tool_call>(\w+(?:\.\w+)*)\s*:\s*(\{[\s\S]*?\})/gi
  let openMatch: RegExpExecArray | null
  while ((openMatch = openPattern.exec(content)) !== null) {
    const isCovered = options.rawMatches.some(existing => {
      const idx = existing.indexOf(openMatch[0])
      if (idx === -1) return false
      return openMatch.index >= idx && openMatch.index < idx + existing.length
    })
    if (isCovered) continue
    // const 声明行内的 <tool_call> 绝不可能是真实工具
    if (isInConstDeclaration(content, openMatch.index)) continue

    options.rawMatches.push(openMatch[0])
    const rawName = openMatch[1].trim()
    const normalizedName = normalizeToolName(rawName)
    if (!options.allowedNames.has(normalizedName)) {
      options.invalidToolNames.push(rawName)
      continue
    }
    let args: unknown = {}
    try { args = JSON.parse(openMatch[2]); } catch { args = openMatch[2]; }
    const argsJson = typeof args === 'string' ? args : JSON.stringify(args ?? {})
    options.toolCalls.push(
      buildToolCall(`call_${options.toolCalls.length}`, options.toolCalls.length, normalizedName, argsJson, openMatch[0]),
    )
  }

  // ── 涌格式 XML 属性式：<tool_call>Bash command="ls -la" is_managed="false"></Bash>
  const attrPattern = /<tool_call>(\w+)((?:\s+\w+="[^"]*")*)\s*>\s*([\s\S]*?)<\/\1>/gi
  let attrMatch: RegExpExecArray | null
  while ((attrMatch = attrPattern.exec(content)) !== null) {
    const isCovered = options.rawMatches.some(existing => {
      const idx = existing.indexOf(attrMatch[0])
      if (idx === -1) return false
      return attrMatch.index >= idx && attrMatch.index < idx + existing.length
    })
    if (isCovered) continue
    // const 声明行内的 <tool_call> 绝不可能是真实工具
    if (isInConstDeclaration(content, attrMatch.index)) continue

    options.rawMatches.push(attrMatch[0])
    const rawName = attrMatch[1].trim()
    const normalizedName = normalizeToolName(rawName)
    if (!options.allowedNames.has(normalizedName)) {
      options.invalidToolNames.push(rawName)
      continue
    }

    const attrs: Record<string, string> = {}
    const attrStr = attrMatch[2].trim()
    // 严格校验：属性提取只在合法工具标签内进行；若属性串/内容像源码
    // （如 const attrRegex = /(\w+)="..."/g 这类讲解），则不是真实工具
    if (looksLikeSourceCode(attrStr) || looksLikeSourceCode(attrMatch[3] || '')) {
      options.invalidToolNames.push(rawName)
      continue
    }
    const attrRegex = /(\w+)="([^"]*)"/g
    let am: RegExpExecArray | null
    while ((am = attrRegex.exec(attrStr)) !== null) {
      attrs[am[1]] = am[2]
    }

    const innerContent = attrMatch[3].trim()
    let args: unknown = {}
    if (Object.keys(attrs).length > 0) {
      args = attrs
    } else if (innerContent) {
      try { args = JSON.parse(innerContent); } catch { args = innerContent; }
    }

    const argsJson = typeof args === 'string' ? args : JSON.stringify(args ?? {})
    options.toolCalls.push(
      buildToolCall(`call_${options.toolCalls.length}`, options.toolCalls.length, normalizedName, argsJson, attrMatch[0]),
    )
  }

  // ── 无闭合标签 + 含点号工具名 + 括号参数式：<tool_call>BashTool.Command(command="ls -la src/")
  // 部分模型（如 glm 系列）在强制 tool_call 格式时输出的非标准格式。
  const dotAttrPattern = /<tool_call>([A-Za-z_][\w.]*(?:\.[A-Za-z_]\w*)*)\s*\(([\s\S]*?)\)\s*(?:<\/tool_call>)?/gi
  let dotMatch: RegExpExecArray | null
  while ((dotMatch = dotAttrPattern.exec(content)) !== null) {
    const isCovered = options.rawMatches.some(existing => {
      const idx = existing.indexOf(dotMatch[0])
      if (idx === -1) return false
      return dotMatch.index >= idx && dotMatch.index < idx + existing.length
    })
    if (isCovered) continue
    // const 声明行内的 <tool_call> 绝不可能是真实工具
    if (isInConstDeclaration(content, dotMatch.index)) continue

    // 守卫：排除从"文件内容/源码/讲解"里误提取。
    // 1) 前导边界：<tool_call> 前若是 = / ( | ` 字母数字汉字（赋值/正则/讲解语境）则跳过
    const prevChar = dotMatch.index > 0 ? content[dotMatch.index - 1] : ''
    if (dotMatch.index > 0 && /[=`|A-Za-z0-9一-鿿]/.test(prevChar)) continue
    // 2) inner 内容若是正则字面量/源码（含正则元字符 [\s\S] (?: \s* 或 /.../ 字面正则）则跳过。
    //    注意：不再用 looksLikeSourceCode(dotInner) 守卫——GLM 真实工具调用常是
    //    Python 风格参数列表 `Name(ByVal=None, ByRef=None, args={'command': '...'})`，
    //    天然含多个逗号，会被 looksLikeSourceCode 的"逗号多值=源码"判定误杀。
    //    此处仅排除"正则字面量/源码特征行"。⚠️ 历史坑：原正则含 \\w / \\d，会匹配任何
    //    含字母/数字的参数字串，导致 <tool_call>Read(filepath: "D:\xxx\a.ts") 这种
    //    真实调用（参数全是字母数字路径）被误杀 → 工具漏提、流直接 stop。
    //    已移除 \\w / \\d，只保留真正的正则源码特征（[\s\S]、(?:、\s* 字面元字符、
    //    以及 /pattern/ 正则字面量），路径/普通参数不再被误杀。真正的讲解误提仍由
    //    isInConstDeclaration + 前导边界守卫（prevChar）在上方拦截。
    const dotInner = dotMatch[2] || ''
    if (/\[\\?[\s\S]|(?::|\(\?:)|\\s\*/.test(dotInner)) continue
    if (/\/\s*[^\s]+\s*\/[a-z]*/i.test(dotInner)) continue

    options.rawMatches.push(dotMatch[0])
    const rawName = dotMatch[1].trim()
    const normalizedName = normalizeToolName(rawName)
    if (!options.allowedNames.has(normalizedName)) {
      options.invalidToolNames.push(rawName)
      continue
    }

    const argStr = dotMatch[2]
    const args: Record<string, unknown> = {}
    // GLM 网页版常输出 Python 风格参数：`Name(ByVal=None, ByRef=None, args={'command': '...', 'description': '...'})`。
    // 工具真正需要的参数是 args 的值（一个字典）。优先提取 `args = {...}` 字典内容作为工具参数；
    // 若没有 args= 键，再退化到平铺 key=value 解析（兼容 `command="ls -la"` 等格式）。
    const argsDictMatch = argStr.match(/args\s*=\s*(\{[\s\S]*\})/)
    if (argsDictMatch) {
      // 修复：字典值内部可能含逗号/嵌套，用 readBalancedJson 精确截取平衡大括号
      const balanced = readBalancedJson(argsDictMatch[1], 0)
      const dictText = balanced ? balanced.json : argsDictMatch[1]
      try {
        const parsedDict = JSON.parse(dictText)
        if (parsedDict && typeof parsedDict === 'object' && !Array.isArray(parsedDict)) {
          Object.assign(args, parsedDict)
        }
      } catch {
        // 字典解析失败时退化为平铺解析
        parseFlatArgs(argStr, args)
      }
    } else {
      parseFlatArgs(argStr, args)
    }

    const argsJson = JSON.stringify(args)
    options.toolCalls.push(
      buildToolCall(`call_${options.toolCalls.length}`, options.toolCalls.length, normalizedName, argsJson, dotMatch[0]),
    )
  }

  // 平铺解析 key=value / key="value" / key='value'（GLM 无 args= 包裹时的退化路径）
  function parseFlatArgs(argStr: string, args: Record<string, unknown>): void {
    const parts = argStr.split(',')
    for (const part of parts) {
      const eqIdx = part.indexOf('=')
      if (eqIdx === -1) continue
      const key = part.slice(0, eqIdx).trim()
      let val = part.slice(eqIdx + 1).trim()
      if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
        val = val.slice(1, -1)
      } else if (val.startsWith("'") && val.endsWith("'") && val.length >= 2) {
        val = val.slice(1, -1)
      }
      let parsed: unknown = val
      try {
        parsed = JSON.parse(val)
      } catch {
        parsed = val
      }
      addParameter(args, key, parsed)
    }
  }

  // ── GLM 网页版真实格式：<tool_call>NAME>\n<子标签>值</子标签>\n</invoke> ──
  // 例：<tool_call>Bash>\n<command>ls -la src/</command>\n</invoke>
  // 注意结尾是 </invoke> 而非 </NAME>，内部用子标签承载参数。
  const glmPattern = /<tool_call>([A-Za-z_][\w.]*)\s*>\s*([\s\S]*?)<\/invoke>/gi
  let glmMatch: RegExpExecArray | null
  while ((glmMatch = glmPattern.exec(content)) !== null) {
    const isCovered = options.rawMatches.some((existing) => {
      const idx = existing.indexOf(glmMatch[0])
      if (idx === -1) return false
      return glmMatch.index >= idx && glmMatch.index < idx + existing.length
    })
    if (isCovered) continue
    // const 声明行内的 <tool_call> 绝不可能是真实工具
    if (isInConstDeclaration(content, glmMatch.index)) continue

    options.rawMatches.push(glmMatch[0])
    const rawName = glmMatch[1].trim()
    const normalizedName = normalizeToolName(rawName)
    if (!options.allowedNames.has(normalizedName)) {
      options.invalidToolNames.push(rawName)
      continue
    }

    // 解析内部子标签 <tag>value</tag> 为 args 对象
    const inner = glmMatch[2]
    const args: Record<string, unknown> = {}
    const childRegex = /<([A-Za-z_][\w.-]*)>([\s\S]*?)<\/\1>/g
    let childMatch: RegExpExecArray | null
    let hasChild = false
    while ((childMatch = childRegex.exec(inner)) !== null) {
      hasChild = true
      const tag = childMatch[1]
      let val: unknown = childMatch[2].trim()
      try {
        val = JSON.parse(String(val))
      } catch {
        // 保留原始字符串
      }
      addParameter(args, tag, val)
    }

    // 若没有子标签，整段内部当作纯文本参数
    if (!hasChild) {
      const trimmed = inner.trim()
      if (trimmed) addParameter(args, 'input', trimmed)
    }

    const argsJson = JSON.stringify(args)
    // 排除源码/讲解误提取：inner 像源码参数列表（逗号分隔多值）则跳过
    if (looksLikeSourceCode(inner)) {
      options.invalidToolNames.push(rawName)
      continue
    }
    // 需要文件的工具（Read/Write/Edit）若未提取到具体文件路径，视为误提取
    if (toolNeedsFile(normalizedName) && !hasFilePathValue(args)) {
      options.invalidToolNames.push(rawName)
      continue
    }
    options.toolCalls.push(
      buildToolCall(`call_${options.toolCalls.length}`, options.toolCalls.length, normalizedName, argsJson, glmMatch[0]),
    )
  }
}

/**
 * GLM 网页版 Anthropic 风格命名空间格式：
 *   <antml:tool_calls>
 *   <antml:tool_call name="Bash" type="function">
 *   <antml:parameter name="command" type="string">cat 'D:\...\x.ts'</antml:parameter>
 *   </antml:tool_call>
 *   </antml:tool_calls>
 * 标签带 `antml:` 命名空间前缀（也兼容其它前缀或无前缀）。参数值常被包一层
 * 单/双引号（如 'D:\...'），需剥除首尾引号再作为真实参数值。
 */
function parseAntmlFormat(content: string, options: {
  rawMatches: string[]
  invalidToolNames: string[]
  allowedNames: Set<string>
  toolCalls: ReturnType<typeof buildToolCall>[]
}): void {
  // ── 行级源码/注释过滤（与 GLM 整体"文件内容回显不得提取"规则一致）──
  // GLM 在读取文件后，会以一定概率把"文件内容"（含源码、// 注释、/* 块注释、
  // * 续行、缩进代码等）当正文回显出来。这些行里若恰好出现
  // <antml:tool_call> 等标记（如文件路径、讲解代码），绝不能当成真实工具调用提取。
  // 规则：逐行检查，凡是非自然语言行（注释/纯代码）整行剔除，再喂给 antml 正则。
  //   删除行：去缩进后以 // 开头、以 /* 开头、以 * 开头（块注释续行）；
  //           或纯缩进+代码特征行（含 =;{}() 且无明显自然语言断句）。
  //   保留行：含中文讲解、或正常的 <antml: 标签行、或普通自然语言。
  const filtered = content
    .split('\n')
    .filter((line) => {
      const t = line.replace(/^\s+/, '')
      if (t.startsWith('//')) return false
      if (t.startsWith('/*')) return false
      if (t.startsWith('*')) return false
      // 纯代码行：含源码特征（赋值/分号/括号/关键字）且无中文、无空格断句的自然语言
      const hasCodeMarks = /[=;{}()]|=>|\b(function|class|const|let|var|import|export|return|if|for|while)\b/.test(line)
      const hasCJK = /[一-鿿]/.test(line)
      const looksLikeCode = hasCodeMarks && !hasCJK && !/[,，。；;]\s*\S/.test(line) && /^[\w$.'"[]/.test(t)
      if (looksLikeCode) return false
      return true
    })
    .join('\n')

  // 命名空间前缀：antml: 或任意 a-z 前缀（含冒号），或无前缀。
  const ns = '[A-Za-z][\\w]*:?'
  const blockRegex = new RegExp(`<${ns}tool_calls>([\\s\\S]*?)<\\/${ns}tool_calls>`, 'gi')
  let blockMatch: RegExpExecArray | null
  while ((blockMatch = blockRegex.exec(filtered)) !== null) {
    const isCovered = options.rawMatches.some((existing) => {
      const idx = existing.indexOf(blockMatch[0])
      if (idx === -1) return false
      return blockMatch.index >= idx && blockMatch.index < idx + existing.length
    })
    if (isCovered) continue
    if (isInConstDeclaration(filtered, blockMatch.index)) continue

    options.rawMatches.push(blockMatch[0])
    const blockInner = blockMatch[1]
    const callRegex = new RegExp(`<${ns}tool_call\\s+name="([^"]+)"[^>]*>([\\s\\S]*?)<\\/${ns}tool_call>`, 'gi')
    let callMatch: RegExpExecArray | null
    while ((callMatch = callRegex.exec(blockInner)) !== null) {
      const rawName = callMatch[1].trim()
      const normalizedName = normalizeToolName(rawName)
      if (!options.allowedNames.has(normalizedName)) {
        options.invalidToolNames.push(rawName)
        continue
      }
      const paramsInner = callMatch[2]
      const args: Record<string, unknown> = {}
      // 子标签可能带前缀：<antml:parameter name="command" type="string">VALUE</...>
      const paramRegex = new RegExp(`<${ns}parameter\\s+name="([^"]+)"[^>]*>([\\s\\S]*?)<\\/${ns}parameter>`, 'gi')
      let pm: RegExpExecArray | null
      while ((pm = paramRegex.exec(paramsInner)) !== null) {
        const pname = pm[1].trim()
        let pval = pm[2].trim()
        // 剥除参数值外层包裹的单/双引号（GLM 常输出 'D:\...' 或 "D:\..."）
        if (
          (pval.startsWith("'") && pval.endsWith("'") && pval.length >= 2) ||
          (pval.startsWith('"') && pval.endsWith('"') && pval.length >= 2)
        ) {
          pval = pval.slice(1, -1)
        }
        let parsed: unknown = pval
        try {
          parsed = JSON.parse(pval)
        } catch {
          // 保留原始字符串
        }
        addParameter(args, pname, parsed)
      }
      // 若完全没有 <parameter> 子标签，则整段 call 内部当作纯文本参数
      if (Object.keys(args).length === 0) {
        const trimmed = paramsInner.trim()
        if (trimmed) addParameter(args, 'input', trimmed)
      }
      const argsJson = JSON.stringify(args)
      // 排除源码/讲解误提取
      if (looksLikeSourceCode(paramsInner)) {
        options.invalidToolNames.push(rawName)
        continue
      }
      // 需要文件的工具（Read/Write/Edit）若未提取到具体文件路径，视为误提取
      if (toolNeedsFile(normalizedName) && !hasFilePathValue(args)) {
        options.invalidToolNames.push(rawName)
        continue
      }
      options.toolCalls.push(
        buildToolCall(`call_${options.toolCalls.length}`, options.toolCalls.length, normalizedName, argsJson, callMatch[0]),
      )
    }
  }
}

/**
 * Surge/Claude XML 子标签变体：
 *   <tool_call>
 *     <toolName>ls</toolName>
 *     <arguments>
 *       <path>.</path>
 *       <showHidden>false</showHidden>
 *     </arguments>
 *   </tool_call>
 *
 * 参数还可为原生 JSON 字符串：
 *   <tool_call>
 *     <toolName>read_file</toolName>
 *     <arguments>{"filePath":"D:\\a.ts"}</arguments>
 *   </tool_call>
 *
 * 先于 parseSurgeFormat 调用：parseSurgeFormat 会把 <toolName> 当作工具名
 * （normalizeToolName('toolName')='ToolName'，不在白名单 → 丢弃），导致真实工具
 * 名丢失且参数写成纯文本，强行作为正文。本分支专门识别 <toolName> 子标签提取
 * 工具名，并把 <arguments> 内的 XML 子标签（<path>.</path>）或 JSON 串解析为
 * 参数对象 { path: '.', showHidden: false }。
 */
function parseToolNameSubtagFormat(content: string, options: {
  rawMatches: string[]
  invalidToolNames: string[]
  allowedNames: Set<string>
  toolCalls: ReturnType<typeof buildToolCall>[]
}): void {
  const blockPattern = /<tool_call>([\s\S]*?)<\/tool_call>/gi
  let blockMatch: RegExpExecArray | null
  while ((blockMatch = blockPattern.exec(content)) !== null) {
    // const 声明行 / 注释行内的 <tool_call> 绝不可能是真实工具
    if (isInConstDeclaration(content, blockMatch.index)) continue

    const inner = blockMatch[1].trim()
    // 仅处理含 <toolName> 子标签的结构；否则交给 parseSurgeFormat 兜底
    const nameMatch = /<toolName\s*>([\s\S]*?)<\/toolName\s*>/i.exec(inner)
    if (!nameMatch) continue

    options.rawMatches.push(blockMatch[0])
    const rawName = decodeXml(nameMatch[1].trim())
    // 优先用原始工具名直接比对白名单（如 request.tools 里声明的 `ls`），
    // 避免 normalizeToolName 将 `ls` 归一成 `ListFiles` 而与声明名失配；
    // 归一化名仅在原始名未命中时作为兜底（兼容 GLM 等的别名输出）。
    const normalizedName = normalizeToolName(rawName)
    const matchedName = options.allowedNames.has(rawName)
      ? rawName
      : options.allowedNames.has(normalizedName)
        ? normalizedName
        : null
    if (matchedName === null) {
      options.invalidToolNames.push(rawName)
      continue
    }

    // 解析 <arguments> 子标签：优先 JSON 字符串，否则把内层 XML 子标签解析为对象
    const args: Record<string, unknown> = {}
    const argsMatch = /<arguments\s*>([\s\S]*?)<\/arguments\s*>/i.exec(inner)
    if (argsMatch) {
      const argsInner = decodeXml(argsMatch[1].trim())
      // 顶层是合法 JSON（对象/数组）→ 直接用作参数
      const jsonStart = argsInner.indexOf('{') !== -1 ? argsInner.indexOf('{') : argsInner.indexOf('[')
      if (jsonStart !== -1) {
        const balanced = readBalancedJson(argsInner, jsonStart)
        if (balanced) {
          try {
            const parsed = JSON.parse(balanced.json)
            if (parsed && typeof parsed === 'object') {
              Object.assign(args, parsed as Record<string, unknown>)
            }
          } catch {
            /* 继续用子标签解析 */
          }
        }
      }
      // JSON 解析失败 or 为空 → XML 子标签 < tag>value</tag> 逐个提取
      if (Object.keys(args).length === 0) {
        const childRegex = /<([A-Za-z_][\w.-]*)>([\s\S]*?)<\/\1>/g
        let childMatch: RegExpExecArray | null
        while ((childMatch = childRegex.exec(argsInner)) !== null) {
          let val: unknown = decodeXml(childMatch[2].trim())
          try {
            val = JSON.parse(String(val))
          } catch {
            // 子标签的值保留为原始字符串（含布尔/数字由 JSON.parse 已尝试）
          }
          addParameter(args, childMatch[1].trim(), val)
        }
      }
    }

    // 无 <arguments> 或子标签全空时，把整段非工具名的正文当 input
    if (Object.keys(args).length === 0) {
      const trimmed = inner
        .replace(/<toolName\s*>[\s\S]*?<\/toolName\s*>/gi, '')
        .replace(/<arguments\s*>[\s\S]*?<\/arguments\s*>/gi, '')
        .trim()
      if (trimmed) addParameter(args, 'input', trimmed)
    }

    const argsJson = JSON.stringify(args)
    // 排除源码/讲解误提取（净：inner 像源码参数列表则跳过）
    if (looksLikeSourceCode(inner)) continue
    // 需要文件的工具（Read/Write/Edit）若未提取到具体文件路径，视为误提取
    if (toolNeedsFile(matchedName) && !hasFilePathValue(args)) {
      options.invalidToolNames.push(rawName)
      continue
    }
    options.toolCalls.push(
      buildToolCall(`call_${options.toolCalls.length}`, options.toolCalls.length, matchedName, argsJson, blockMatch[0]),
    )
  }
}
