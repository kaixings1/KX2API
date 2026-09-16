/**
 * 工具运行时新模块单测：标签推导 / 角色权限 / 元工具检索 / 上下文分层 / 输出规范化
 *
 * 覆盖 dev.txt 方案落地的核心行为：
 *   §3  schema 补齐（labels/risk/cost）
 *   §4  角色与权限
 *   §6  元工具 search/load/unload/active
 *   §7  三层暴露与预算
 *   §10 输出结构化与截断
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { ToolDefinition, ToolRole } from '../types'
import { inferLabels, normalizeToolLabels, flattenLabels } from '../toolLabels'
import { defaultRoles, resolveRole, isCoreTool, CORE_TOOL_NAMES } from '../toolRoles'
import {
  searchTools, loadTools, unloadTools, getActiveTools, describeToolDetail, clearSession,
} from '../toolMetaTools'
import { estimateTokens, buildGroupCatalog, buildToolContext, useLayeredContext, computeToolBudget } from '../toolContext'
import { normalizeOutput, checkToolPermission } from '../toolExecutor'
import { summarize, recordToolCall, recordContext, resetMetrics } from '../toolMetrics'

function tool(name: string, over: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    id: over.id ?? name,
    name: over.name ?? name,
    displayName: over.displayName ?? name,
    description: over.description ?? '',
    usage: over.usage ?? `/${name}`,
    platform: over.platform ?? 'all',
    parameters: over.parameters ?? [],
    tags: over.tags ?? [],
    enabled: over.enabled ?? true,
    builtin: over.builtin ?? true,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  }
}

// ==================== §3 标签推导 ====================

describe('toolLabels — 标签推导', () => {
  it('文件类命令推导出 fs 域与只读风险', () => {
    const { labels, risk, cost } = inferLabels('ls', ['file', 'unix'])
    expect(labels.domains).toContain('fs')
    expect(risk).toBe('readonly')
    expect(cost).toBe('low')
  })

  it('删除类命令识别为 destructive', () => {
    expect(inferLabels('rm').risk).toBe('destructive')
    expect(inferLabels('rmdir').risk).toBe('destructive')
  })

  it('网络类命令识别为 network', () => {
    expect(inferLabels('curl').risk).toBe('network')
  })

  it('写入类命令识别为 write', () => {
    expect(inferLabels('mkdir').risk).toBe('write')
    expect(inferLabels('cp').risk).toBe('write')
  })

  it('构建类命令判定为高成本', () => {
    expect(inferLabels('docker').cost).toBe('high')
    expect(inferLabels('cargo-build').cost).toBe('high')
  })

  it('未知命令回落到 utility 域而非崩溃', () => {
    const { labels } = inferLabels('some-weird-cmd-xyz')
    expect(labels.domains).toEqual(['utility'])
  })

  // 回归：宽泛前缀会吞掉特异规则，必须用命令名边界收尾
  it('前缀相近的命令不会被误判（ps 不吞 psql、go 不吞 goodbye、del 不吞 delta）', () => {
    expect(inferLabels('psql').labels.domains).toContain('db')
    expect(inferLabels('ps').labels.domains).toContain('system')
    expect(inferLabels('goodbye').labels.domains).toContain('utility')
    expect(inferLabels('delta').risk).not.toBe('destructive')
  })

  it('curl 归类到 net 而非被更早的规则吞掉', () => {
    expect(inferLabels('curl').labels.domains).toContain('net')
    expect(inferLabels('curl').risk).toBe('network')
  })

  it('带横线的 git 子命令仍能识别风险', () => {
    expect(inferLabels('git-commit').risk).toBe('write')
    expect(inferLabels('git-clone').risk).toBe('network')
    // 只读的 git 子命令不应被误判为写
    expect(inferLabels('git-status').risk).toBe('readonly')
  })

  it('显式声明优先于推导值', () => {
    const t = tool('ls', { risk: 'destructive', cost: 'high', labels: { domains: ['custom'] } })
    const norm = normalizeToolLabels(t)
    expect(norm.risk).toBe('destructive')
    expect(norm.cost).toBe('high')
    expect(norm.labels.domains).toEqual(['custom'])
  })

  it('拍平标签包含七维前缀', () => {
    const { labels, risk, cost } = inferLabels('ls', [])
    const flat = flattenLabels(labels, risk, cost)
    expect(flat.some(f => f.startsWith('domain:'))).toBe(true)
    expect(flat).toContain('risk:readonly')
    expect(flat).toContain('cost:low')
  })
})

// ==================== §4 角色与权限 ====================

describe('toolRoles — 角色', () => {
  it('内置角色覆盖四类 + default 兜底', () => {
    const ids = defaultRoles().map(r => r.id)
    expect(ids).toContain('default')
    expect(ids).toContain('developer')
    expect(ids).toContain('verifier')
    expect(ids).toContain('operator')
  })

  it('verifier 拒绝写/破坏/网络风险', () => {
    const v = resolveRole(defaultRoles(), 'verifier')
    expect(v.deniedRisks).toContain('write')
    expect(v.deniedRisks).toContain('destructive')
    expect(v.deniedRisks).toContain('network')
  })

  it('未命中角色时回落到 default', () => {
    expect(resolveRole(defaultRoles(), 'not-exist').id).toBe('default')
    expect(resolveRole([], 'whatever').id).toBe('default')
  })

  it('核心工具名单含五个元工具', () => {
    for (const n of ['tool_search', 'tool_load', 'tool_unload', 'tool_active', 'tool_describe']) {
      expect(CORE_TOOL_NAMES).toContain(n)
    }
  })

  it('alwaysOn 显式标记即视为核心', () => {
    expect(isCoreTool({ name: 'whatever', alwaysOn: true })).toBe(true)
    expect(isCoreTool({ name: 'whatever' })).toBe(false)
  })
})

// ==================== §6 元工具 ====================

describe('toolMetaTools — 搜索与加载', () => {
  const tools = [
    tool('ls', { description: '列出目录文件', tags: ['file'] }),
    tool('rm', { description: '删除文件', tags: ['file'] }),
    tool('git-status', { description: 'git 状态', tags: ['git'] }),
    tool('tool_search', { alwaysOn: true, description: '搜索工具' }),
  ]

  it('按关键词命中并按分数排序（精确名优先）', () => {
    const cards = searchTools({ query: 'ls', tools })
    expect(cards[0].id).toBe('ls')
  })

  it('空查询返回前 N 个，不报错', () => {
    const cards = searchTools({ query: '', tools, limit: 2 })
    expect(cards).toHaveLength(2)
  })

  it('按标签过滤要求全部命中', () => {
    const cards = searchTools({ query: '', tools, tags: ['risk:destructive'] })
    expect(cards.map(c => c.id)).toContain('rm')
    expect(cards.map(c => c.id)).not.toContain('ls')
  })

  it('无匹配时返回空数组', () => {
    expect(searchTools({ query: 'zzz-not-exist-zzz', tools })).toEqual([])
  })

  it('卡片含 risk/cost/tags 等检索维度', () => {
    const [card] = searchTools({ query: 'rm', tools })
    expect(card.risk).toBe('destructive')
    expect(card.tags.length).toBeGreaterThan(0)
  })

  it('loadTools 拒绝角色禁止的风险等级', () => {
    clearSession('s1')
    // default 角色不禁止任何风险 → 应能加载
    const res = loadTools(['rm'], tools, defaultRoles(), 's1')
    expect(res.loaded).toContain('rm')

    clearSession('s2')
    // verifier 禁止 destructive → rm 必须被拒
    const res2 = loadTools(['rm'], tools, defaultRoles(), 's2', 'verifier')
    expect(res2.loaded).toHaveLength(0)
    expect(res2.rejected[0].reason).toContain('destructive')
  })

  it('loadTools 对不存在的工具给出明确原因', () => {
    clearSession('s3')
    const res = loadTools(['ghost'], tools, defaultRoles(), 's3')
    expect(res.rejected[0].reason).toContain('不存在')
  })

  it('unloadTools 不卸载核心工具', () => {
    clearSession('s4')
    const res = unloadTools(['tool_search'], tools, 's4')
    expect(res.kept).toContain('tool_search')
  })

  it('getActiveTools 始终包含核心工具', () => {
    clearSession('s5')
    expect(getActiveTools(tools, 's5')).toContain('tool_search')
  })

  it('describeToolDetail 输出包含风险与用法', () => {
    const text = describeToolDetail(tool('rm', { description: '删文件', whenToUse: ['清理构建产物'] }))
    expect(text).toContain('rm')
    expect(text).toContain('destructive')
    expect(text).toContain('清理构建产物')
  })
})

// ==================== §7 上下文分层 ====================

describe('toolContext — 三层暴露', () => {
  const core = tool('tool_search', { alwaysOn: true })
  const normal = tool('ls', { description: '列目录' })
  const extra = tool('rm', { description: '删文件' })

  it('默认关闭分层（灰度开关）', () => {
    expect(useLayeredContext({})).toBe(false)
    expect(useLayeredContext({ KX2_TOOL_CONTEXT: 'layered' })).toBe(true)
    expect(useLayeredContext({ KX2_TOOL_CONTEXT: '1' })).toBe(true)
  })

  it('未加载的非核心工具不进上下文', () => {
    clearSession('c1')
    // ls 属于核心基础集（始终进上下文）；rm 是普通工具，未加载则不应出现
    const ctx = buildToolContext({ tools: [core, normal, extra], groups: [], sessionId: 'c1' })
    expect(ctx.activeTools.map(t => t.name)).toContain('tool_search')
    expect(ctx.activeTools.map(t => t.name)).toContain('ls')
    expect(ctx.activeTools.map(t => t.name)).not.toContain('rm')
  })

  it('已加载的工具进入 L2', () => {
    clearSession('c2')
    loadTools(['ls'], [core, normal, extra], defaultRoles(), 'c2')
    const ctx = buildToolContext({ tools: [core, normal, extra], groups: [], sessionId: 'c2' })
    expect(ctx.activeTools.map(t => t.name)).toContain('ls')
  })

  it('预算不足时淘汰非核心且保留核心', () => {
    clearSession('c3')
    loadTools(['ls', 'rm'], [core, normal, extra], defaultRoles(), 'c3')
    const ctx = buildToolContext({
      tools: [core, normal, extra], groups: [], sessionId: 'c3', budgetTokens: 1,
    })
    expect(ctx.activeTools.map(t => t.name)).toContain('tool_search')
    expect(ctx.evicted.length).toBeGreaterThan(0)
  })

  it('组目录只给组名与数量，不含工具 schema', () => {
    const catalog = buildGroupCatalog(
      [{ id: 'fs', name: '文件', description: '文件操作', toolIds: ['ls'], enabled: true, builtin: true, createdAt: 0 }],
      [normal],
    )
    expect(catalog).toContain('fs')
    expect(catalog).toContain('(1)')
    expect(catalog).not.toContain('parameters')
  })

  it('token 估算对中英文都给正值', () => {
    expect(estimateTokens('hello world')).toBeGreaterThan(0)
    expect(estimateTokens('你好世界')).toBeGreaterThan(0)
    expect(estimateTokens('')).toBe(0)
  })

  it('预算按比例计算，缺省 20%', () => {
    expect(computeToolBudget(1000)).toBe(200)
    expect(computeToolBudget(1000, 50)).toBe(500)
  })
})

// ==================== §10 输出规范化 ====================

describe('toolExecutor — 输出与权限', () => {
  it('非结构化输出包成 { raw }', () => {
    const out = normalizeOutput('hello')
    expect(out.truncated).toBe(false)
    expect(out.data).toEqual({ raw: 'hello' })
  })

  it('结构化输出正确解析 JSON', () => {
    const out = normalizeOutput('{"a":1}', true)
    expect(out.data).toEqual({ a: 1 })
  })

  it('结构化解析失败时回落为 { raw }', () => {
    const out = normalizeOutput('not-json', true)
    expect(out.data).toEqual({ raw: 'not-json' })
  })

  it('超大输出被截断并标记', () => {
    const big = 'x'.repeat(20 * 1024)
    const out = normalizeOutput(big)
    expect(out.truncated).toBe(true)
    expect(out.bytes).toBeGreaterThan(16 * 1024)
  })

  it('核心元工具不受角色限制（只读）', () => {
    const d = checkToolPermission({
      tool: tool('tool_search', { alwaysOn: true }),
      roles: defaultRoles(),
      roleId: 'verifier',
    })
    expect(d.allowed).toBe(true)
  })

  // 回归：核心豁免必须排在角色校验之后，否则 verifier 能用 exec 绕过写禁令
  it('核心基础集 exec 不能绕过 verifier 的角色限制', () => {
    const d = checkToolPermission({
      tool: tool('exec'), roles: defaultRoles(), roleId: 'verifier', isActive: true,
    })
    expect(d.allowed).toBe(false)
  })

  it('verifier 调用写类工具被拒', () => {
    const d = checkToolPermission({
      tool: tool('mkdir'), roles: defaultRoles(), roleId: 'verifier',
    })
    expect(d.allowed).toBe(false)
    expect(d.reason).toContain('write')
  })

  it('未加载的非核心工具被拒并提示先加载', () => {
    // 用非核心工具（rm）验证；核心工具（ls/tool_search 等）不需要加载即可用
    const d = checkToolPermission({
      tool: tool('rm'), roles: defaultRoles(), roleId: 'default', isActive: false,
    })
    expect(d.allowed).toBe(false)
    expect(d.reason).toContain('tool_load')
  })

  it('destructive 工具放行但标记需确认', () => {
    const d = checkToolPermission({
      tool: tool('rm'), roles: defaultRoles(), roleId: 'default', isActive: true,
    })
    expect(d.allowed).toBe(true)
    expect(d.needsConfirmation).toBe(true)
  })

  it('万能执行器按 destructive 处理，default 角色下仍需确认', () => {
    const d = checkToolPermission({
      tool: tool('exec'), roles: defaultRoles(), roleId: 'default', isActive: true,
    })
    expect(d.allowed).toBe(true)
    expect(d.risk).toBe('destructive')
    expect(d.needsConfirmation).toBe(true)
  })

  it('exec 被视为破坏性风险，因此不会被判为只读', () => {
    expect(inferLabels('exec').risk).toBe('destructive')
    expect(inferLabels('powershell').risk).toBe('destructive')
  })
})

// ==================== §13 度量 ====================

describe('toolMetrics — 度量汇总', () => {
  beforeEach(() => resetMetrics())

  it('统计成功率与误选率', () => {
    recordToolCall({ sessionId: 's', tool: 'ls', wasActive: true, allowed: true, durationMs: 10, outputBytes: 100, ok: true })
    recordToolCall({ sessionId: 's', tool: 'rm', wasActive: false, allowed: true, durationMs: 20, outputBytes: 200, ok: false })
    const sum = summarize()
    expect(sum.totalCalls).toBe(2)
    expect(sum.successRate).toBe(0.5)
    expect(sum.misselectRate).toBe(0.5)
  })

  it('统计上下文成本与分层占比', () => {
    recordContext({ sessionId: 's', layered: true, exposed: 5, total: 100, estimatedTokens: 200, evicted: 2 })
    recordContext({ sessionId: 's', layered: false, exposed: 100, total: 100, estimatedTokens: 5000, evicted: 0 })
    const sum = summarize()
    expect(sum.totalContexts).toBe(2)
    expect(sum.avgExposedTools).toBe(52.5)
    expect(sum.layeredRatio).toBe(0.5)
  })

  it('TopN 按调用次数排序', () => {
    for (let i = 0; i < 3; i++) {
      recordToolCall({ sessionId: 's', tool: 'ls', wasActive: true, allowed: true, durationMs: 1, outputBytes: 1, ok: true })
    }
    recordToolCall({ sessionId: 's', tool: 'rm', wasActive: true, allowed: true, durationMs: 1, outputBytes: 1, ok: true })
    expect(summarize().topTools[0]).toEqual({ name: 'ls', count: 3 })
  })

  it('空数据不产生 NaN', () => {
    const sum = summarize()
    expect(sum.totalCalls).toBe(0)
    expect(Number.isNaN(sum.successRate)).toBe(false)
  })

  it('角色 deniedTags 命中即拒绝', () => {
    const role: ToolRole = {
      id: 'r', name: 'R', description: '', defaultGroups: [], allowedGroups: [],
      deniedTags: ['risk:network'], deniedRisks: [], maxActiveTools: 10, builtin: false, createdAt: 0,
    }
    const d = checkToolPermission({ tool: tool('curl'), roles: [role], roleId: 'r', isActive: true })
    expect(d.allowed).toBe(false)
    expect(d.reason).toContain('risk:network')
  })
})
