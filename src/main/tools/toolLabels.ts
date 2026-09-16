/**
 * tools/toolLabels.ts — 工具标签 / 风险 / 成本的推导与规范化
 *
 * 背景（dev.txt §4）：工具集需要「角色 / 目的 / 能力域 / 风险 / 成本 / 环境 / 权限」
 * 七维标签，才能做检索、权限判定和默认加载决策。历史数据只有朴素 tags
 * （如 ['file','unix']），且 255 个内置命令不可能逐个手写标签。
 *
 * 策略：规则推导 + 显式覆盖。
 *   - inferLabels(name, tags)：按命令名/既有 tags 推导出结构化标签与风险等级
 *   - 显式写在 ToolDefinition 上的字段（risk/cost/labels）永远优先于推导值
 * 这样既不给存量数据做大规模迁移，也能立刻拿到可用的检索维度。
 */

import type { ToolCost, ToolLabels, ToolRisk } from './types'

/** 命令名 → 能力域 / 角色的关键词规则（按顺序命中即用） */
const DOMAIN_RULES: Array<{ re: RegExp; domains: string[]; roles: string[] }> = [
  { re: /^(git|gh)[-_]?/, domains: ['git'], roles: ['developer'] },
  { re: /^(docker|kubectl|k8s|helm)/, domains: ['container', 'deploy'], roles: ['operator'] },
  { re: /^(npm|pnpm|yarn|node|bun|tsc|vite|esbuild|webpack)/, domains: ['build'], roles: ['developer'] },
  { re: /^(python|python3|pip|pytest|uv|poetry)/, domains: ['code'], roles: ['developer'] },
  { re: /^(cargo|rustc|go|mvn|gradle)/, domains: ['build'], roles: ['developer'] },
  { re: /^(ls|dir|tree|cat|pwd|cp|mv|rm|mkdir|rmdir|touch|find|findstr|head|tail|wc)/, domains: ['fs'], roles: ['developer', 'verifier'] },
  { re: /^(grep|rg|search|ag|ack)/, domains: ['search'], roles: ['developer'] },
  { re: /^(curl|wget|ping|ssh|scp|http|fetch)/, domains: ['net'], roles: ['operator', 'researcher'] },
  { re: /^(md5|sha|hash|cert|sign|base64|openssl)/, domains: ['crypto'], roles: ['verifier'] },
  { re: /^(curl|http)/, domains: ['net'], roles: ['researcher'] },
  { re: /^(browser|playwright|puppeteer|selenium)/, domains: ['browser'], roles: ['researcher'] },
  { re: /^(sql|psql|mysql|sqlite|redis|mongo)/, domains: ['db'], roles: ['operator'] },
  { re: /^(test|vitest|jest|mocha|coverage|lint|eslint|oxlint)/, domains: ['test'], roles: ['verifier', 'developer'] },
  { re: /^(env|set|export|whoami|date|ps|tasklist|systeminfo|version|stats)/, domains: ['system'], roles: ['operator'] },
  { re: /^(help|clear|new|config|model|profiles|login|add-profile|del-profile)/, domains: ['utility'], roles: ['developer'] },
  { re: /^(team|agent|plan|task)/, domains: ['ai'], roles: ['developer'] },
  { re: /^(exec|shell|run|eval|bash|sh|cmd)/, domains: ['shell'], roles: ['operator'] },
]

/** 明确会写盘/改状态的高风险命令 */
const DESTRUCTIVE_RE = /^(rm|rmdir|del|format|mkfs|dd|shutdown|reboot|kill|killall|taskkill|drop|truncate|reset)/
const WRITE_RE = /^(cp|mv|mkdir|touch|echo|tee|sed|patch|git[-_]?(commit|push|revert|reset|checkout)|npm[-_]?(install|add|remove)|pip[-_]?install)/
const NETWORK_RE = /^(curl|wget|ping|ssh|scp|http|fetch|npm[-_]?(install|publish)|pip[-_]?install|git[-_]?clone)/

/** 高成本命令：通常耗时较长或输出量大 */
const HIGH_COST_RE = /^(build|compile|test|install|clone|deploy|docker|kubectl|mvn|gradle|cargo[-_]?build)/

/**
 * 按命令名与既有 tags 推导结构化标签。
 * 纯函数，无副作用，便于测试。
 */
export function inferLabels(name: string, tags: string[] = []): {
  labels: ToolLabels
  risk: ToolRisk
  cost: ToolCost
} {
  const n = name.toLowerCase()
  const domains = new Set<string>()
  const roles = new Set<string>()

  for (const rule of DOMAIN_RULES) {
    if (rule.re.test(n)) {
      rule.domains.forEach(d => domains.add(d))
      rule.roles.forEach(r => roles.add(r))
      break
    }
  }

  // 既有 tags 映射到能力域（历史数据里 'file' / 'search' / 'git' 等很常见）
  for (const t of tags) {
    const key = t.toLowerCase()
    if (key === 'file' || key === 'windows' || key === 'unix') domains.add('fs')
    else if (key === 'search') domains.add('search')
    else if (key === 'git') domains.add('git')
    else if (key === 'exec' || key === 'code') domains.add('shell')
    else if (key === 'system') domains.add('system')
    else if (key === 'utility') domains.add('utility')
    else if (key === 'ai') domains.add('ai')
    else if (key === 'dev' || key === 'profile') domains.add('utility')
  }

  if (domains.size === 0) domains.add('utility')

  // 风险：destructive > network > write > readonly
  let risk: ToolRisk = 'readonly'
  if (DESTRUCTIVE_RE.test(n)) risk = 'destructive'
  else if (NETWORK_RE.test(n)) risk = 'network'
  else if (WRITE_RE.test(n)) risk = 'write'

  const cost: ToolCost = HIGH_COST_RE.test(n) ? 'high' : 'low'

  // 目的：按风险反推，便于按 purpose 检索
  const purposes: string[] = []
  if (risk === 'readonly') purposes.push('read')
  if (risk === 'write') purposes.push('write')
  if (risk === 'network') purposes.push('net')
  if (risk === 'destructive') purposes.push('destroy')
  if (roles.has('verifier')) purposes.push('verify')

  return {
    labels: {
      roles: [...roles],
      purposes: [...new Set(purposes)],
      domains: [...domains],
      cost,
      env: ['local'],
    },
    risk,
    cost,
  }
}

/**
 * 合并显式字段与推导值：显式优先。
 * 用于工具加载时补齐标签，不覆盖用户/内置已声明的值。
 */
export function normalizeToolLabels<T extends {
  name: string
  tags?: string[]
  risk?: ToolRisk
  cost?: ToolCost
  labels?: ToolLabels
}>(tool: T): { risk: ToolRisk; cost: ToolCost; labels: ToolLabels } {
  const inferred = inferLabels(tool.name, tool.tags || [])
  const labels: ToolLabels = {
    roles: tool.labels?.roles ?? inferred.labels.roles,
    purposes: tool.labels?.purposes ?? inferred.labels.purposes,
    domains: tool.labels?.domains ?? inferred.labels.domains,
    cost: tool.labels?.cost ?? inferred.labels.cost,
    env: tool.labels?.env ?? inferred.labels.env,
  }
  return {
    risk: tool.risk ?? inferred.risk,
    cost: tool.cost ?? inferred.cost,
    labels,
  }
}

/** 把结构化标签拍平成可检索的字符串数组（形如 'domain:fs'、'risk:write'） */
export function flattenLabels(labels: ToolLabels, risk: ToolRisk, cost: ToolCost): string[] {
  const out: string[] = []
  for (const r of labels.roles || []) out.push(`role:${r}`)
  for (const p of labels.purposes || []) out.push(`purpose:${p}`)
  for (const d of labels.domains || []) out.push(`domain:${d}`)
  for (const e of labels.env || []) out.push(`env:${e}`)
  out.push(`risk:${risk}`)
  out.push(`cost:${cost}`)
  return out
}
