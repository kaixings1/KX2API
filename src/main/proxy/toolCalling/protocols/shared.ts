import type { NormalizedToolDefinition, NormalizedToolResult, ToolParseResult, ToolProtocolId } from '../types.ts'
import type { ToolProtocolDetection } from './base.ts'
import type { ToolCall } from '../../types.ts'

export function detectMarkers(buffer: string, markers: string[]): ToolProtocolDetection {
  let earliest = -1
  for (const marker of markers) {
    const index = buffer.indexOf(marker)
    if (index !== -1 && (earliest === -1 || index < earliest)) {
      earliest = index
    }
  }

  if (earliest !== -1) {
    return { matched: true, partial: false, markerStart: earliest }
  }

  for (let index = 0; index < buffer.length; index += 1) {
    const suffix = buffer.slice(index)
    if (markers.some((marker) => marker.startsWith(suffix))) {
      return { matched: false, partial: true, markerStart: index }
    }
  }

  return { matched: false, partial: false }
}

export function stripFencedCodeBlocks(content: string): string {
  return content.replace(/```(?:[a-zA-Z0-9_-]*)?\n?([\s\S]*?)```/g, (fence, inner: string) => {
    const looksLikeTool =
      /<invoke\b/.test(inner) ||
      /<tool_call\b/.test(inner) ||
      /\bname\s*=\s*"(Bash|Read|Write|Edit|Grep|Glob|ListFiles|WebSearch|WebExtractor|CodeInterpreter)"/.test(inner) ||
      /"name"\s*:\s*"(Bash|Read|Write|Edit|Grep|Glob|ListFiles|WebSearch|WebExtractor|CodeInterpreter)"/.test(inner) ||
      /"arguments"\s*:/.test(inner)
    return looksLikeTool ? '\n' + inner + '\n' : ''
  })
}

export function toolNames(tools: NormalizedToolDefinition[]): Set<string> {
  return new Set(tools.map((tool) => tool.name))
}

export function createParseResult(input: {
  content: string
  toolCalls: ToolCall[]
  protocol: ToolProtocolId | 'unknown'
  rawMatches: string[]
  invalidToolNames?: string[]
  malformedReason?: string
}): ToolParseResult {
  return {
    content: input.content,
    toolCalls: input.toolCalls,
    protocol: input.protocol,
    rawMatches: input.rawMatches,
    malformedReason: input.malformedReason,
    invalidToolNames: input.invalidToolNames ?? [],
  }
}

export function buildToolCall(
  id: string,
  index: number,
  name: string,
  args: string,
  rawText?: string,
): ToolCall {
  return {
    id,
    index,
    type: 'function',
    function: {
      name,
      arguments: normalizeArguments(args),
    },
    ...(rawText ? { rawText } : {}),
  } as ToolCall
}

export function normalizeArguments(args: unknown): string {
  if (typeof args === 'string') {
    const trimmed = args.trim()
    if (!trimmed) return '{}'
    try {
      return JSON.stringify(JSON.parse(trimmed))
    } catch {
      return trimmed
    }
  }

  return JSON.stringify(args ?? {})
}

export function parseJsonValue(value: string): unknown {
  const trimmed = unwrapCdata(value).trim()
  if (!trimmed) return ''

  try {
    return JSON.parse(trimmed)
  } catch {
    const repaired = tryRepairIncompleteJsonObject(trimmed)
    if (repaired !== null) return repaired
    return decodeXml(trimmed)
  }
}

export function unwrapCdata(value: string): string {
  const cdata = value.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/)
  return cdata ? cdata[1] : value
}

export function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

export function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function repairToolArguments(
  args: Record<string, unknown>,
  toolDefs: NormalizedToolDefinition[],
): Record<string, unknown> {
  const byName = new Map(toolDefs.map((t) => [t.name, t]))

  for (const [, toolDef] of byName) {
    const schema = toolDef.parameters as Record<string, unknown> | null
    if (!schema) continue
    const properties = (schema.properties || {}) as Record<string, Record<string, unknown>>
    const schemaKeys = Object.keys(properties)
    if (schemaKeys.length === 0) continue

    const normalized = normalizeKeys(args, schemaKeys)
    const coerced = coerceTypes(normalized, properties)
    const withDefaults = injectDefaults(coerced, properties)
    if (normalized !== args || coerced !== normalized || withDefaults !== coerced) {
      args = withDefaults
    }
  }

  return args
}

function camelToSnake(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function normalizeKeys(
  input: Record<string, unknown>,
  schemaKeys: string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const schemaKeysLower = new Map(schemaKeys.map((k) => [k.toLowerCase(), k]))

  for (const [key, value] of Object.entries(input)) {
    if (schemaKeys.includes(key)) {
      result[key] = value
      continue
    }

    const ciMatch = schemaKeysLower.get(key.toLowerCase())
    if (ciMatch) {
      result[ciMatch] = value
      continue
    }

    const snakeKey = camelToSnake(key)
    const camelKey = snakeToCamel(key)
    const convMatch = schemaKeys.find(
      (sk) => sk === snakeKey || sk === camelKey || sk.toLowerCase() === snakeKey || sk.toLowerCase() === camelKey,
    )
    if (convMatch) {
      result[convMatch] = value
      continue
    }

    let bestKey: string | null = null
    let bestSim = 0
    for (const sk of schemaKeys) {
      const d = levenshtein(key.toLowerCase(), sk.toLowerCase())
      const maxLen = Math.max(key.length, sk.length)
      const sim = maxLen > 0 ? 1 - d / maxLen : 0
      if (sim > bestSim) {
        bestSim = sim
        bestKey = sk
      }
    }
    if (bestKey && bestSim >= 0.75) {
      result[bestKey] = value
      continue
    }

    result[key] = value
  }

  return result
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i)

  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const temp = dp[j]
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev
      } else {
        dp[j] = 1 + Math.min(prev, dp[j], dp[j - 1])
      }
      prev = temp
    }
  }

  return dp[n]
}

const BOOL_MAP: Record<string, boolean> = {
  true: true, false: false, yes: true, no: false, '1': true, '0': false,
}

function coerceTypes(
  input: Record<string, unknown>,
  properties: Record<string, Record<string, unknown>>,
): Record<string, unknown> {
  const result = { ...input }

  for (const [key, value] of Object.entries(result)) {
    if (value === undefined) continue
    const fieldSchema = properties[key]
    if (!fieldSchema) continue
    const fieldType = fieldSchema.type as string | void
    if (!fieldType) continue

    if (fieldType === 'number' || fieldType === 'integer') {
      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed === '') {
          delete result[key]
          continue
        }
        const num = Number(trimmed)
        if (!Number.isNaN(num)) result[key] = num
      }
    }

    if (fieldType === 'boolean' && typeof value === 'string') {
      const mapped = BOOL_MAP[value.toLowerCase()]
      if (mapped !== undefined) result[key] = mapped
    }

    if (fieldType === 'array' && !Array.isArray(value) && value !== undefined) {
      result[key] = [value]
    }
  }

  return result
}

function injectDefaults(
  input: Record<string, unknown>,
  properties: Record<string, Record<string, unknown>>,
): Record<string, unknown> {
  const result = { ...input }

  for (const [key, fieldSchema] of Object.entries(properties)) {
    if (key in result && result[key] !== undefined) continue
    const defaultValue = fieldSchema.default
    if (defaultValue !== undefined) {
      result[key] = defaultValue
    }
  }

  return result
}

export function addParameter(target: Record<string, unknown>, name: string, value: unknown): void {
  const existing = target[name]
  if (existing === undefined) {
    target[name] = value
  } else if (Array.isArray(existing)) {
    target[name] = [...existing, value]
  } else {
    target[name] = [existing, value]
  }
}

export function renderToolList(tools: NormalizedToolDefinition[]): string {
  return tools
    .map((tool) => {
      const parameters = JSON.stringify(tool.parameters ?? {})
      return `Tool \`${tool.name}\`: ${tool.description || 'No description'}. Arguments JSON schema: ${parameters}`
    })
    .join('\n')
}

export function genericToolResultBlock(result: NormalizedToolResult): string {
  return `[TOOL_RESULT for ${result.toolCallId}] ${result.content}`
}

export function stableStringify(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  const sortedKeys = Object.keys(value as Record<string, unknown>).sort()
  return '{' + sortedKeys.map(k => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k])).join(',') + '}'
}

export const TOOL_NAME_MAPPING: Record<string, string> = {
  bash: 'Bash', cmd: 'Bash', shell: 'Bash', powershell: 'Bash', batch: 'Bash',
  read: 'Read', cat: 'Read', write: 'Write', edit: 'Edit', str_replace_editor: 'StrReplaceEditor',
  glob: 'Glob', find: 'Glob', ls: 'ListFiles', dir: 'ListFiles', listfiles: 'ListFiles', list_dir: 'ListFiles', list_directory: 'ListFiles',
  read_file: 'Read', read_file_content: 'Read', write_file: 'Write', write_to_file: 'Write', replace_in_file: 'Edit',
  grep: 'Glob', search_content: 'Grep',
  web_search: 'WebSearch', fetch_url: 'WebExtractor', web_extractor: 'WebExtractor',
  code_interpreter: 'CodeInterpreter', execute_code: 'CodeInterpreter',
  execute_command: 'Bash', run_command: 'Bash',
}

export function normalizeToolName(name: string): string {
  const colonBase = name.includes(':') ? name.split(':').pop() || name : name
  const dotBase = colonBase.includes('.') ? colonBase.split('.')[0] : colonBase
  const lower = dotBase.toLowerCase()
  return TOOL_NAME_MAPPING[lower] || colonBase.charAt(0).toUpperCase() + colonBase.slice(1)
}

export function readBalancedJson(
  text: string,
  start: number,
): { json: string; end: number } | null {
  let i = start
  while (i < text.length && /\s/.test(text[i])) i++
  if (i >= text.length) return null
  const open = text[i]
  if (open !== '{' && open !== '[') return null
  const close = open === '{' ? '}' : ']'
  let stack = 0, inString = false, escape = false
  for (let pos = i; pos < text.length; pos++) {
    const ch = text[pos]
    if (inString) {
      if (escape) { escape = false; continue }
      if (ch === '\\') { escape = true; continue }
      if (ch === '"') { inString = false; continue }
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === open) stack++
    else if (ch === close) {
      stack--
      if (stack === 0) return { json: text.slice(i, pos + 1), end: pos + 1 }
    }
  }
  return null
}

export function looksLikeToolCall(text: string): boolean {
  const t = text.trimStart()
  if (t.startsWith('{') || t.startsWith('[tool_calls]') || t.startsWith('[{')) return true
  if (/^Action:\s*\w+/.test(t)) return true
  if (t.includes('{"tool_calls"')) return true
  if (/"tool_calls"\s*:\s*\[/.test(t)) return true
  if (/"tool_name"\s*:\s*"/.test(t) && t.includes('{')) return true
  if (t.includes('"function_call"')) return true
  if (t.includes('"tool_use"')) return true
  if (/\[Called tools?:/.test(t)) return true
  if (/```(?:json)?[\s\S]*"tool_calls"/.test(t)) return true
  return false
}

export function tryRepairIncompleteJsonObject(text: string): unknown | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{')) return null

  let repaired = trimmed
  let inString = false
  let escape = false
  let depth = 0

  for (const ch of repaired) {
    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\' && inString) {
      escape = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (!inString) {
      if (ch === '{') depth++
      else if (ch === '}') depth--
    }
  }

  if (inString) repaired += '"'
  while (depth > 0) {
    repaired += '}'
    depth--
  }

  try {
    return JSON.parse(repaired)
  } catch {
    return null
  }
}

export function mapCommandForPlatform(cmd: string): string {
  return cmd
}
