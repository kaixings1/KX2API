/**
 * tools/toolMetaTools.ts — 元工具：搜索 / 加载 / 卸载 / 查看活跃 / 查看文档
 *
 * 背景（dev.txt §6）：文件不是发现机制。工具多了以后不可能把全部 schema 常驻
 * 上下文，模型必须能「搜索 → 加载 → 调用 → 卸载」。这里提供五个元工具：
 *
 *   tool_search(query, group?, tags?, limit?)  返回工具卡片（不含完整 schema）
 *   tool_load(ids)                             把工具纳入当前会话活跃集
 *   tool_unload(ids)                           移出活跃集
 *   tool_active()                              列出当前活跃工具
 *   tool_describe(id)                          返回单个工具的详细文档
 *
 * 设计要点：
 *   - 检索用「标签 + 关键词打分」，不依赖外部索引；255 个量级下线性扫描足够快。
 *   - 会话状态存在模块级 Map（按 sessionId 隔离），不做跨进程持久化。
 *   - 元工具自身永远可调用，不受角色 deniedTags 限制。
 */

import type { ToolDefinition } from './types'
import { flattenLabels, normalizeToolLabels } from './toolLabels'
import { isCoreTool, resolveRole } from './toolRoles'

// ==================== 会话活跃集 ====================

export interface SessionToolState {
  /** 当前活跃工具 id 集合 */
  active: Set<string>
  /** 角色 id */
  roleId: string
  /** 最近使用时间（LRU 淘汰依据） */
  lastUsed: Map<string, number>
}

/** sessionId → 状态。会话结束由 clearSession 清理，避免长期驻留。 */
const sessions = new Map<string, SessionToolState>()

const DEFAULT_SESSION = 'default'

function getState(sessionId: string = DEFAULT_SESSION): SessionToolState {
  let s = sessions.get(sessionId)
  if (!s) {
    s = { active: new Set(), roleId: 'default', lastUsed: new Map() }
    sessions.set(sessionId, s)
  }
  return s
}

/** 设置会话角色（新建会话时调用） */
export function setSessionRole(sessionId: string, roleId: string): void {
  getState(sessionId).roleId = roleId
}

/** 清理会话状态 */
export function clearSession(sessionId: string): void {
  sessions.delete(sessionId)
}

/** 记录一次工具使用，供 LRU 排序 */
export function touchTool(sessionId: string, toolId: string): void {
  getState(sessionId).lastUsed.set(toolId, Date.now())
}

// ==================== 检索 ====================

export interface ToolCard {
  id: string
  summary: string
  group: string
  tags: string[]
  risk: string
  cost: string
}

/** 把一个工具拍成检索用的可打分文本 */
function searchText(tool: ToolDefinition): string {
  const { risk, cost, labels } = normalizeToolLabels(tool)
  const parts = [
    tool.id, tool.name, tool.displayName, tool.description, tool.usage,
    ...(tool.tags || []),
    ...flattenLabels(labels, risk, cost),
    ...(tool.whenToUse || []),
  ]
  return parts.filter(Boolean).join(' ').toLowerCase()
}

/**
 * 对单个工具按查询串打分。分数 0 表示不匹配。
 * 权重：id/name 精确命中最高，其次是标签，最后是描述正文。
 */
function scoreTool(tool: ToolDefinition, tokens: string[]): number {
  if (tokens.length === 0) return 1
  const text = searchText(tool)
  const name = tool.name.toLowerCase()
  let score = 0
  for (const tk of tokens) {
    if (!tk) continue
    if (name === tk) score += 100
    else if (name.includes(tk)) score += 50
    else if (tool.id.toLowerCase().includes(tk)) score += 30
    else if (text.includes(tk)) score += 10
  }
  return score
}

export interface SearchOptions {
  query: string
  group?: string
  tags?: string[]
  limit?: number
  /** 可检索的工具全集（由调用方注入，避免此处反向依赖 toolManager） */
  tools: ToolDefinition[]
  /** 分组 id → 工具 id 列表，用于 group 过滤 */
  groups?: Array<{ id: string; toolIds: string[] }>
}

/**
 * 搜索工具，返回工具卡片（不含完整 schema，控制 token）。
 * 无查询串时按 limit 返回前 N 个（便于「看看有什么」）。
 */
export function searchTools(opts: SearchOptions): ToolCard[] {
  const limit = Math.max(1, Math.min(opts.limit ?? 5, 50))
  const tokens = (opts.query || '')
    .toLowerCase()
    .split(/[\s,，]+/)
    .map(s => s.trim())
    .filter(Boolean)

  let pool = opts.tools
  // 分组过滤
  if (opts.group && opts.groups) {
    const g = opts.groups.find(x => x.id === opts.group || x.id === `group-${opts.group}`)
    if (g) {
      const ids = new Set(g.toolIds)
      pool = pool.filter(t => ids.has(t.id) || ids.has(t.name))
    }
  }
  // 标签过滤：要求全部命中（AND）
  if (opts.tags && opts.tags.length > 0) {
    const want = opts.tags.map(t => t.toLowerCase())
    pool = pool.filter(t => {
      const { risk, cost, labels } = normalizeToolLabels(t)
      const own = [...flattenLabels(labels, risk, cost), ...(t.tags || [])].map(s => s.toLowerCase())
      return want.every(w => own.some(o => o.includes(w)))
    })
  }

  return pool
    .map(t => ({ tool: t, score: scoreTool(t, tokens) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name))
    .slice(0, limit)
    .map(({ tool }) => {
      const { risk, cost, labels } = normalizeToolLabels(tool)
      const domains = labels.domains || []
      return {
        id: tool.id,
        summary: tool.description || tool.displayName || tool.name,
        group: domains[0] || 'other',
        tags: flattenLabels(labels, risk, cost).slice(0, 6),
        risk,
        cost,
      }
    })
}

// ==================== 加载 / 卸载 ====================

export interface LoadResult {
  loaded: string[]
  rejected: Array<{ id: string; reason: string }>
}

/**
 * 把工具加入活跃集，按角色做权限校验。
 * 权限在「加载」和「调用」两处都要查（dev.txt §8：不能只查一次）。
 */
export function loadTools(
  ids: string[],
  tools: ToolDefinition[],
  roles: Parameters<typeof resolveRole>[0],
  sessionId: string = DEFAULT_SESSION,
  /** 显式指定角色；不传则用会话已设置的角色（默认 default） */
  roleId?: string
): LoadResult {
  const state = getState(sessionId)
  const role = resolveRole(roles, roleId || state.roleId)
  const loaded: string[] = []
  const rejected: Array<{ id: string; reason: string }> = []

  for (const id of ids) {
    const tool = tools.find(t => t.id === id || t.name === id)
    if (!tool) { rejected.push({ id, reason: '工具不存在' }); continue }

    const { risk, labels } = normalizeToolLabels(tool)
    if (role.deniedRisks.includes(risk)) {
      rejected.push({ id, reason: `角色 ${role.id} 禁止风险等级 ${risk}` })
      continue
    }
    const flat = flattenLabels(labels, risk, normalizeToolLabels(tool).cost)
    const hitDenied = role.deniedTags.find(dt => flat.some(f => f === dt || f.startsWith(dt)))
    if (hitDenied) {
      rejected.push({ id, reason: `命中角色禁用标签 ${hitDenied}` })
      continue
    }
    // allowedGroups 非空时限定可加载范围
    if (role.allowedGroups.length > 0) {
      const inAllowed = (labels.domains || []).some(d => role.allowedGroups.includes(d))
      if (!inAllowed && !role.allowedGroups.includes(tool.id)) {
        rejected.push({ id, reason: `不在角色 ${role.id} 允许的组内` })
        continue
      }
    }

    state.active.add(tool.id)
    state.lastUsed.set(tool.id, Date.now())
    loaded.push(tool.id)
  }

  // 超出上限 → 按 LRU 淘汰非核心工具
  evictIfNeeded(state, tools, role.maxActiveTools)
  return { loaded, rejected }
}

/** 活跃集超过上限时，按「最后使用时间」淘汰非核心工具 */
function evictIfNeeded(state: SessionToolState, tools: ToolDefinition[], max: number): void {
  const candidates = [...state.active]
    .map(id => tools.find(t => t.id === id))
    .filter((t): t is ToolDefinition => !!t && !isCoreTool(t))
  if (candidates.length + countCore(state, tools) <= max) return

  const overflow = candidates.length + countCore(state, tools) - max
  candidates
    .sort((a, b) => (state.lastUsed.get(a.id) || 0) - (state.lastUsed.get(b.id) || 0))
    .slice(0, overflow)
    .forEach(t => state.active.delete(t.id))
}

function countCore(state: SessionToolState, tools: ToolDefinition[]): number {
  let n = 0
  for (const id of state.active) {
    const t = tools.find(x => x.id === id)
    if (t && isCoreTool(t)) n++
  }
  return n
}

/** 卸载指定工具（核心工具不可卸载） */
export function unloadTools(
  ids: string[],
  tools: ToolDefinition[],
  sessionId: string = DEFAULT_SESSION
): { unloaded: string[]; kept: string[] } {
  const state = getState(sessionId)
  const unloaded: string[] = []
  const kept: string[] = []
  for (const id of ids) {
    const tool = tools.find(t => t.id === id || t.name === id)
    if (tool && isCoreTool(tool)) { kept.push(id); continue }
    if (state.active.delete(id)) unloaded.push(id)
    else if (tool) { state.active.delete(tool.id); unloaded.push(tool.id) }
    else kept.push(id)
  }
  return { unloaded, kept }
}

/** 当前活跃工具 id 列表（含核心工具） */
export function getActiveTools(
  tools: ToolDefinition[],
  sessionId: string = DEFAULT_SESSION
): string[] {
  const state = getState(sessionId)
  const set = new Set(state.active)
  for (const t of tools) if (isCoreTool(t)) set.add(t.id)
  return [...set]
}

/** 生成单个工具的详细文档文本（tool_describe 用） */
export function describeToolDetail(tool: ToolDefinition): string {
  const { risk, cost, labels } = normalizeToolLabels(tool)
  const lines = [
    `# ${tool.name}`,
    tool.displayName && tool.displayName !== tool.name ? `名称：${tool.displayName}` : '',
    `描述：${tool.description || '（无）'}`,
    `用法：${tool.usage}`,
    `风险：${risk}　成本：${cost}`,
    `标签：${flattenLabels(labels, risk, cost).join(', ')}`,
    tool.whenToUse?.length ? `何时使用：\n${tool.whenToUse.map(s => `  - ${s}`).join('\n')}` : '',
    tool.whenNotToUse?.length ? `何时不用：\n${tool.whenNotToUse.map(s => `  - ${s}`).join('\n')}` : '',
    tool.parameters?.length
      ? `参数：\n${tool.parameters.map(p => `  - ${p.name} (${p.type})${p.required ? ' 必填' : ''} — ${p.description}`).join('\n')}`
      : '参数：无',
    tool.template ? `执行模板：${tool.template}` : '',
  ]
  return lines.filter(Boolean).join('\n')
}

// ==================== 元工具的命令实现 ====================

export interface MetaToolDeps {
  /** 当前全部工具（每次调用时取，保证拿到最新数据） */
  getTools: () => ToolDefinition[]
  getGroups: () => Array<{ id: string; name: string; description: string; toolIds: string[] }>
  getRoles: () => Parameters<typeof resolveRole>[0]
  sessionId?: string
}

/**
 * 构造五个元工具的执行体。
 * 返回 Record<name, execute>，由调用方注册进命令注册表，避免此处循环依赖 registry。
 */
export function createMetaToolHandlers(deps: MetaToolDeps): Record<string, (args: string[]) => Promise<{ success: boolean; output?: string; error?: string }>> {
  const sid = () => deps.sessionId || DEFAULT_SESSION

  return {
    /** tool_search <关键词> [--group <组>] [--tags a,b] [--limit N] */
    tool_search: async (args: string[]) => {
      const { query, group, tags, limit } = parseSearchArgs(args)
      const cards = searchTools({
        query,
        group,
        tags,
        limit,
        tools: deps.getTools(),
        groups: deps.getGroups(),
      })
      if (cards.length === 0) {
        return {
          success: true,
          output: `未找到匹配「${query}」的工具。可尝试更宽泛的关键词，或先调用 tool_search 不带参数浏览全部。`,
        }
      }
      const lines = cards.map(c => `- ${c.id} | ${c.summary} | 组:${c.group} | ${c.risk}/${c.cost} | ${c.tags.join(' ')}`)
      return {
        success: true,
        output: `匹配到 ${cards.length} 个工具（用 tool_load 加载后可调用）：\n${lines.join('\n')}`,
      }
    },

    /** tool_load <id...> */
    tool_load: async (args: string[]) => {
      const ids = args.filter(a => !a.startsWith('-'))
      if (ids.length === 0) return { success: false, error: '用法: tool_load <工具id...>' }
      const res = loadTools(ids, deps.getTools(), deps.getRoles(), sid())
      const parts: string[] = []
      if (res.loaded.length > 0) parts.push(`已加载：${res.loaded.join(', ')}（下一轮可在上下文中看到完整定义，可直接调用）`)
      if (res.rejected.length > 0) {
        parts.push(`被拒绝：\n${res.rejected.map(r => `  - ${r.id}: ${r.reason}`).join('\n')}`)
      }
      return { success: true, output: parts.join('\n') || '没有工具被加载' }
    },

    /** tool_unload <id...> */
    tool_unload: async (args: string[]) => {
      const ids = args.filter(a => !a.startsWith('-'))
      if (ids.length === 0) return { success: false, error: '用法: tool_unload <工具id...>' }
      const res = unloadTools(ids, deps.getTools(), sid())
      const parts: string[] = []
      if (res.unloaded.length > 0) parts.push(`已卸载：${res.unloaded.join(', ')}`)
      if (res.kept.length > 0) parts.push(`未卸载（核心工具或不存在）：${res.kept.join(', ')}`)
      return { success: true, output: parts.join('\n') || '没有工具被卸载' }
    },

    /** tool_active */
    tool_active: async () => {
      const tools = deps.getTools()
      const active = getActiveTools(tools, sid())
      const lines = active.map(id => {
        const t = tools.find(x => x.id === id)
        const core = t && isCoreTool(t) ? ' [核心]' : ''
        return `- ${id}${core}${t ? ` — ${t.description || ''}` : ''}`
      })
      return { success: true, output: `当前活跃工具 (${active.length})：\n${lines.join('\n')}` }
    },

    /** tool_describe <id> */
    tool_describe: async (args: string[]) => {
      const id = (args[0] || '').trim()
      if (!id) return { success: false, error: '用法: tool_describe <工具id>' }
      const tool = deps.getTools().find(t => t.id === id || t.name === id)
      if (!tool) return { success: false, error: `工具不存在: ${id}` }
      return { success: true, output: describeToolDetail(tool) }
    },
  }
}

/** 解析 tool_search 的参数：第一个非 flag 词是查询串，其余是 --group/--tags/--limit */
function parseSearchArgs(args: string[]): { query: string; group?: string; tags?: string[]; limit?: number } {
  const out: { query: string; group?: string; tags?: string[]; limit?: number } = { query: '' }
  const rest: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--group' || a === '-g') { out.group = args[++i]; continue }
    if (a === '--tags' || a === '-t') { out.tags = (args[++i] || '').split(',').map(s => s.trim()).filter(Boolean); continue }
    if (a === '--limit' || a === '-n') { out.limit = Number(args[++i]) || undefined; continue }
    rest.push(a)
  }
  out.query = rest.join(' ')
  return out
}
