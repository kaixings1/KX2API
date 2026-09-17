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

const DEFAULT_SESSION = 'default'

/**
 * sessionId → 状态。会话结束由 clearSession 清理，避免长期驻留。
 *
 * ⚠️ 这是**内存缓存**，事实来源是 `toolSessionStore`（落盘）。
 * 之所以保留这一层：`buildToolContext` / `touchTool` 在工具循环的热路径上，
 * 每次同步读盘不可接受。落盘由 store 侧做防抖批量写。
 *
 * 之所以要落盘：原先纯内存的实现「重启即丢」——
 * 用户 tool_load 进来的工具在重启后全部失效，而对话历史还在，
 * 模型以为工具仍可用于是调用失败。
 */
const sessions = new Map<string, SessionToolState>()

/** 该会话是否已从磁盘水合过 */
const hydrated = new Set<string>()

function getState(sessionId: string = DEFAULT_SESSION): SessionToolState {
  let s = sessions.get(sessionId)
  if (!s) {
    s = { active: new Set(), roleId: 'default', lastUsed: new Map() }
    sessions.set(sessionId, s)
    void hydrate(sessionId, s)
  }
  return s
}

/**
 * 从落盘状态水合到内存（异步，不阻塞首帧）。
 * 水合期间若内存已有更新，做并集合并而非覆盖，避免丢掉刚发生的变化。
 */
async function hydrate(sessionId: string, target: SessionToolState): Promise<void> {
  if (hydrated.has(sessionId)) return
  hydrated.add(sessionId)
  try {
    const { toolSessionStore } = await import('./toolSessionStore.ts')
    const st = await toolSessionStore.get(sessionId)
    // 并集：水合可能与并发写入竞争，不能简单覆盖
    for (const id of st.active) target.active.add(id)
    if (st.roleId && st.roleId !== 'default') target.roleId = st.roleId
    for (const [id, ts] of Object.entries(st.lastUsed)) {
      const cur = target.lastUsed.get(id) || 0
      if (ts > cur) target.lastUsed.set(id, ts)
    }
  } catch (e) {
    console.warn('[ToolMeta] 会话状态水合失败:', (e as Error).message)
  }
}

/** 把内存状态同步回落盘存储（由各写操作调用） */
function persistState(sessionId: string, s: SessionToolState): void {
  void (async () => {
    try {
      const { toolSessionStore } = await import('./toolSessionStore.ts')
      const st = await toolSessionStore.get(sessionId)
      st.active = [...s.active]
      st.roleId = s.roleId
      st.lastUsed = Object.fromEntries(s.lastUsed)
      st.updatedAt = Date.now()
      toolSessionStore.markDirty()
    } catch (e) {
      console.warn('[ToolMeta] 会话状态落盘失败:', (e as Error).message)
    }
  })()
}

/** 设置会话角色（新建会话时调用） */
export function setSessionRole(sessionId: string, roleId: string): void {
  const s = getState(sessionId)
  s.roleId = roleId
  persistState(sessionId, s)
}

/** 清理会话状态（内存 + 落盘） */
export function clearSession(sessionId: string): void {
  sessions.delete(sessionId)
  hydrated.delete(sessionId)
  void (async () => {
    try {
      const { toolSessionStore } = await import('./toolSessionStore.ts')
      await toolSessionStore.remove(sessionId)
    } catch {
      /* 清理失败不影响主流程 */
    }
  })()
}

/** 记录一次工具使用，供 LRU 排序 */
export function touchTool(sessionId: string, toolId: string): void {
  const s = getState(sessionId)
  s.lastUsed.set(toolId, Date.now())
  persistState(sessionId, s)
}

/** 取某工具在会话内的最后使用时间（从未使用返回 0，供 LRU 优先淘汰） */
export function lastUsedAt(sessionId: string, toolId: string): number {
  return getState(sessionId).lastUsed.get(toolId) || 0
}

/**
 * 用对话历史重建活跃集，与当前内存状态取并集。
 *
 * 用途：应用重启 / 会话恢复后，仅靠落盘可能不完整（例如历史里有
 * 落盘之前发生的工具调用）。以历史为事实来源补齐。
 *
 * @param messages       对话消息
 * @param availableTools 当前可用工具名集合
 */
export function reconcileFromHistory(
  sessionId: string,
  messages: readonly unknown[],
  availableTools: ReadonlySet<string>,
  /** 可用工具 id 集合；缺省时按「id === name」的现状复用 availableTools */
  availableIds?: ReadonlySet<string>,
): string[] {
  const s = getState(sessionId)
  const ids = availableIds ?? availableTools
  void (async () => {
    try {
      const { deriveActiveToolsFromMessages, mergeActiveTools } = await import('./toolSessionStore.ts')
      const derived = deriveActiveToolsFromMessages(messages, availableTools)
      const merged = mergeActiveTools([...s.active], derived, ids, availableTools)
      if (merged.length === s.active.size && merged.every(id => s.active.has(id))) return
      s.active = new Set(merged)
      persistState(sessionId, s)
    } catch (e) {
      console.warn('[ToolMeta] 历史重建失败:', (e as Error).message)
    }
  })()
  return [...s.active]
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

/**
 * 把工具名/id 拆成片段。
 *
 * 必须先拆 camelCase 再小写 —— 小写后 `readFile` 与 `readfile` 无法区分。
 * `git_status` / `gitStatus` / `mcp__fs__read` / `fs.read` 都应拆出 `git`/`status` 等独立片段。
 *
 * 片段化是避免子串误报的关键：裸 `includes` 会让 `git` 命中 `digital`
 * （d-i-**g-i-t**-a-l），片段化后 `digital` 是一个整体片段，不再误命中。
 */
function splitNameFragments(raw: string): string[] {
  return raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .map(s => s.toLowerCase())
    .filter(Boolean)
}

/** 把工具的各字段分别拍成小写文本，供分维度打分 */
function searchFields(tool: ToolDefinition): {
  name: string
  nameFragments: string[]
  hint: string
  tags: string
  desc: string
} {
  const { risk, cost, labels } = normalizeToolLabels(tool)
  const rawName = `${tool.name || ''} ${tool.id || ''}`
  const name = rawName.toLowerCase()
  const nameFragments = splitNameFragments(rawName)
  const hint = (tool.searchHint || []).join(' ').toLowerCase()
  const tags = [...(tool.tags || []), ...flattenLabels(labels, risk, cost)]
    .join(' ')
    .toLowerCase()
  const desc = [
    tool.displayName, tool.description, tool.usage,
    ...(tool.whenToUse || []), ...(tool.whenNotToUse || []),
  ].filter(Boolean).join(' ').toLowerCase()
  return { name, nameFragments, hint, tags, desc }
}

/**
 * 分词：拉丁/数字按词切，中文切**二元组**。
 *
 * 中文刻意不用单字 —— 单个汉字在工具描述里几乎无处不在（"用""文""件"），
 * 判别力接近 0；二元组要求相邻两字都命中，特异性显著更高。
 * 与 `engine/memory/memoryRecall.ts` 的分词策略保持一致，避免同仓库两套口径。
 */
export function tokenizeQuery(text: string): string[] {
  const lowered = (text || '').toLowerCase()
  const tokens: string[] = []
  for (const m of lowered.matchAll(/[a-z0-9_]+/g)) tokens.push(m[0])
  for (const m of lowered.matchAll(/[\u4e00-\u9fa5]+/g)) {
    const run = m[0]
    if (run.length === 1) {
      tokens.push(run)
      continue
    }
    for (let i = 0; i + 2 <= run.length; i++) tokens.push(run.slice(i, i + 2))
  }
  return tokens
}

/** 词边界正则缓存（查询串来自用户，必须设上限防无界增长） */
const boundaryCache = new Map<string, RegExp>()
const BOUNDARY_CACHE_MAX = 500

/**
 * 带词边界的命中判定。
 *
 * 纯 ASCII 词用 `(^|[^a-z0-9])term([^a-z0-9]|$)`，避免 `search` 命中 `research`、
 * `git` 命中 `digital` 这类子串误报（原实现用裸 `includes` 就会这样）。
 * 中文没有 `\b` 概念（CJK 不属于 `\w`），但已二元组化，子串匹配足够特异。
 */
function hasWord(haystack: string, term: string): boolean {
  if (!term || !haystack) return false
  if (!/^[\x00-\x7f]+$/.test(term)) {
    return haystack.includes(term)
  }
  let re = boundaryCache.get(term)
  if (!re) {
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    re = new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`)
    if (boundaryCache.size >= BOUNDARY_CACHE_MAX) boundaryCache.clear()
    boundaryCache.set(term, re)
  }
  return re.test(haystack)
}

/**
 * 分维度权重。每个 token 只取**最高命中的那一档**，不跨档累加 ——
 * 否则一个描述很长的工具会靠堆词刷分，把真正匹配名字的工具挤下去。
 */
const SCORE = {
  nameExact: 10,
  nameFragment: 6,
  namePrefix: 3,
  hintWord: 4,
  tagWord: 2,
  descWord: 1,
} as const

/** 对单个工具按查询词打分。分数 0 表示不匹配。 */
function scoreTool(tool: ToolDefinition, tokens: string[]): number {
  if (tokens.length === 0) return 1
  const f = searchFields(tool)
  let score = 0
  for (const tk of tokens) {
    if (!tk) continue
    if (f.name === tk) {
      // 整个名字字符串完全相等（搜 `git_status`）
      score += SCORE.nameExact
    } else if (f.nameFragments.includes(tk)) {
      // 完整片段相等（搜 `git` 命中 `git_status` 的 git 片段）
      score += SCORE.nameFragment
    } else if (f.nameFragments.some(fr => fr.startsWith(tk))) {
      // 片段前缀（搜 `noteb` 命中 `notebook`）—— 用前缀而非子串，
      // 否则 `git` 会命中 `digital` 这种内部子串
      score += SCORE.namePrefix
    } else if (hasWord(f.hint, tk)) {
      score += SCORE.hintWord
    } else if (hasWord(f.tags, tk)) {
      score += SCORE.tagWord
    } else if (hasWord(f.desc, tk)) {
      score += SCORE.descWord
    }
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

  // 查询串解析：`+term` 标记**必需词**（用于排除近义工具），其余为可选词。
  // 例：`+git commit` → 必须与 git 相关，commit 只加分不强制。
  const raw = (opts.query || '').split(/[\s,，]+/).map(s => s.trim()).filter(Boolean)
  const requiredTerms: string[] = []
  const optionalText: string[] = []
  for (const part of raw) {
    if (part.startsWith('+') && part.length > 1) requiredTerms.push(part.slice(1))
    else optionalText.push(part)
  }
  const tokens = tokenizeQuery(optionalText.join(' '))

  let pool = opts.tools

  // 必需词预过滤：每个必需词至少在一个字段里命中，否则该工具出局。
  // 这一步在打分前做，能显著缩小候选集（254 个工具下尤其明显）。
  if (requiredTerms.length > 0) {
    const reqTokens = requiredTerms.map(t => t.toLowerCase())
    pool = pool.filter(t => {
      const f = searchFields(t)
      const haystack = `${f.name} ${f.hint} ${f.tags} ${f.desc}`
      return reqTokens.every(rt => {
        // 必需词本身也做二元组展开，保证中文必需词能匹配
        const sub = tokenizeQuery(rt)
        const probes = sub.length > 0 ? sub : [rt]
        return probes.some(p => hasWord(haystack, p))
      })
    })
  }

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
  // 加载结果落盘：重启后仍能恢复用户显式 load 进来的工具
  persistState(sessionId, state)
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
  // 卸载同样要落盘 —— 否则重启后被卸载的工具会"复活"
  if (unloaded.length > 0) persistState(sessionId, state)
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
    tool.searchHint?.length ? `检索别名：${tool.searchHint.join(', ')}` : '',
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
          output:
            `未找到匹配「${query}」的工具。\n` +
            `提示：可用 +词 表示必需（如「+git commit」），或不带参数浏览全部工具。`,
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
