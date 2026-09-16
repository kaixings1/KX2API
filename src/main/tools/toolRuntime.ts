/**
 * src/main/tools/toolRuntime.ts — 工具「生效」运行时
 *
 * 解决的问题：`工具管理` 里的分组/启停/平台配置以前只存在于自己的 store 里，
 * 请求链路完全不读它，所以改了没有任何效果。这里把两者接起来：
 *
 *   生效组（config.enabledToolGroups，空数组 = 全局组）
 *     → 组内工具（toolManager 里 enabled 的、平台匹配的）
 *     → 同步环境变量 KX2_TOOL_DEF_<NAME>（1=启用 / 0=禁用）
 *     → 生成要发给模型的工具定义 + 工具清单提示词
 *
 * 每次请求都会重新解析，所以切换分组立即生效，不需要重启。
 */

import type { ToolDefinition as ManagedTool, ToolGroup } from './types'

/** 分组 id 的环境变量覆盖（逗号分隔），便于脚本/调试强制某组 */
export const TOOL_GROUP_ENV = 'KX2_TOOL_GROUP'
/** 单个工具开关的环境变量前缀 */
export const TOOL_DEF_ENV_PREFIX = 'KX2_TOOL_DEF_'

/** 工具名 → 环境变量名，例如 git-status → KX2_TOOL_DEF_GIT_STATUS */
export function toolEnvKey(name: string): string {
  return TOOL_DEF_ENV_PREFIX + String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '_')
}

/** 当前平台是否匹配工具声明的平台 */
export function isPlatformMatch(platform: string | undefined, current: string = process.platform): boolean {
  if (!platform || platform === 'all') return true
  if (platform === 'windows') return current === 'win32'
  if (platform === 'unix') return current !== 'win32'
  return true
}

export interface ResolveInput {
  /** 生效的分组 id；空数组 = 全局组（所有启用的工具） */
  groupIds: string[]
  /** 工具管理里的全部工具定义 */
  tools: ManagedTool[]
  /** 工具管理里的全部分组 */
  groups: ToolGroup[]
  /** 平台，默认 process.platform */
  platform?: string
  /** 环境变量覆盖（测试注入用） */
  env?: Record<string, string | undefined>
}

export interface ResolvedTools {
  /** 实际生效的分组 id（全局组时为空数组） */
  groupIds: string[]
  /** 分组名，用于提示词展示 */
  groupNames: string[]
  /** 是否全局组 */
  isGlobal: boolean
  /** 生效的工具定义（已按 enabled + 平台过滤） */
  tools: ManagedTool[]
  /** 生效的工具名 */
  names: string[]
  /** 被平台过滤掉的工具名（便于 UI 提示） */
  platformSkipped: string[]
  /** 在组里但被关闭（enabled=false）的工具名 */
  disabledSkipped: string[]
}

/**
 * 解析当前生效的工具集合。
 * - groupIds 为空 → 全局组：所有 enabled 的工具
 * - 分组不存在或组内没有可用工具 → 回退到全局组（避免"一个工具都不发"把模型变傻）
 */
export function resolveActiveTools(input: ResolveInput): ResolvedTools {
  const env = input.env || process.env
  const platform = input.platform || process.platform

  const envGroups = (env[TOOL_GROUP_ENV] || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const requested = envGroups.length > 0 ? envGroups : (input.groupIds || [])
  const groupMap = new Map(input.groups.map(g => [g.id, g]))
  const knownGroups = requested.filter(id => groupMap.has(id))

  // 组名展示（包含未知 id，方便排查拼写错误）
  const groupNames = requested.map(id => groupMap.get(id)?.name || id)

  let candidates: ManagedTool[]
  if (knownGroups.length === 0) {
    // 全局组：候选是全部工具，具体为什么被跳过由下面的统一过滤记录（便于 UI / 日志）
    candidates = input.tools
  } else {
    const seen = new Set<string>()
    candidates = []
    for (const id of knownGroups) {
      for (const toolId of groupMap.get(id)!.toolIds) {
        if (seen.has(toolId)) continue
        seen.add(toolId)
        const tool = input.tools.find(t => t.id === toolId || t.name === toolId)
        if (tool) candidates.push(tool)
      }
    }
  }

  const tools: ManagedTool[] = []
  const platformSkipped: string[] = []
  const disabledSkipped: string[] = []
  for (const t of candidates) {
    if (!isPlatformMatch(t.platform, platform)) { platformSkipped.push(t.name); continue }
    if (!t.enabled) { disabledSkipped.push(t.name); continue }
    tools.push(t)
  }

  // 自定义组里可能一个可用工具都没有（全被禁用/平台不符）→ 回退全局组，
  // 否则会出现「组是空的 → 一个工具都不发 → 模型什么也干不了」的迷惑状态。
  const isGlobal = knownGroups.length === 0
  if (!isGlobal && tools.length === 0) {
    const globalRes = resolveActiveTools({ ...input, groupIds: [] })
    return { ...globalRes, groupNames }
  }

  return {
    groupIds: knownGroups,
    groupNames,
    isGlobal,
    tools,
    names: tools.map(t => t.name),
    platformSkipped,
    disabledSkipped,
  }
}

/**
 * 把生效状态同步到环境变量：组内工具 = 1，其余 = 0。
 * 返回本次写入的全部键值，便于日志/UI 展示。
 */
export function applyToolEnvVars(
  resolved: ResolvedTools,
  allTools: ManagedTool[],
  env: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const active = new Set(resolved.names)
  const applied: Record<string, string> = {}
  for (const tool of allTools) {
    const key = toolEnvKey(tool.name)
    const value = active.has(tool.name) ? '1' : '0'
    env[key] = value
    applied[key] = value
  }
  env[TOOL_GROUP_ENV] = resolved.groupIds.join(',')
  applied[TOOL_GROUP_ENV] = env[TOOL_GROUP_ENV] as string
  return applied
}

/** 通用兜底参数：把命令行参数当成字符串数组 */
const GENERIC_ARGS_SCHEMA = {
  type: 'object',
  properties: {
    args: { type: 'array', items: { type: 'string' }, description: '命令参数列表' },
  },
}

/** 工具声明的参数 → JSON Schema；没声明就用通用 args */
export function buildParameterSchema(tool: ManagedTool): Record<string, unknown> {
  const params = tool.parameters || []
  if (params.length === 0) return GENERIC_ARGS_SCHEMA
  const properties: Record<string, unknown> = {}
  const required: string[] = []
  for (const p of params) {
    const prop: Record<string, unknown> = { type: p.type || 'string' }
    if (p.description) prop.description = p.description
    if (p.defaultValue !== undefined) prop.default = p.defaultValue
    properties[p.name] = prop
    if (p.required) required.push(p.name)
  }
  return required.length > 0 ? { type: 'object', properties, required } : { type: 'object', properties }
}

/** 工具的一句话说明（给模型看的「作用 + 语法」） */
export function describeTool(tool: ManagedTool): string {
  const usage = (tool.usage || '').trim()
  const desc = (tool.description || tool.displayName || tool.name).trim()
  if (usage && usage !== `/${tool.name}` && !desc.includes(usage)) {
    return `${desc}（用法：${usage}）`
  }
  return desc
}

/** 生成 OpenAI function 工具定义 */
export function buildOpenAIToolDefinitions(tools: ManagedTool[]): Array<{
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}> {
  return tools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: describeTool(tool),
      parameters: buildParameterSchema(tool),
    },
  }))
}

/**
 * 生成给模型的工具提示块。
 *
 * 只输出「调用约定」这类无法由 tools 字段表达的信息，**不再罗列工具清单**：
 * 可用工具的名称、描述、参数 schema 全部在请求的 tools 字段里，
 * 在 system 正文再列一遍等于同一份信息发两次，纯属浪费 token
 * （工具多时正文那份会吃掉数千 token）。
 *
 * 保留一句计数，是因为模型据此判断「本轮是否真的没有工具」，
 * 避免在零工具时仍尝试发起调用。
 */
export function buildToolHint(resolved: ResolvedTools): string {
  if (resolved.tools.length === 0) {
    return '【工具】当前没有启用任何工具，请直接用文字回答，不要输出工具调用。'
  }
  return `【工具】本轮随请求提供了 ${resolved.tools.length} 个工具（见 tools 字段），只能使用其中列出的名字，不要自造。`
}

/** 从「工具管理」store + 配置里解析当前生效工具，并把开关写入环境变量 */
export async function resolveActiveToolsFromStore(): Promise<{
  resolved: ResolvedTools
  applied: Record<string, string>
}> {
  const { toolManager } = await import('./toolManager')
  const { storeManager } = await import('../store/store')

  const groupIds = (storeManager.getConfig() as { enabledToolGroups?: string[] }).enabledToolGroups || []
  const tools = toolManager.getAllTools()
  const groups = toolManager.getAllGroups()
  const resolved = resolveActiveTools({ groupIds, tools, groups })
  const applied = applyToolEnvVars(resolved, tools)
  return { resolved, applied }
}
