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

/**
 * 命令名 → 能力域 / 角色的关键词规则（按顺序，命中即停）。
 *
 * 顺序敏感：更特异的规则必须排在更宽泛的规则前面，否则会被吞掉。
 * 所有匹配都用「命令名边界」（下划线、横线、点、冒号或结束）收尾，
 * 避免 `ps` 匹配到 `psql`、`go` 匹配到 `goodbye` 这类前缀误判。
 */
const DOMAIN_RULES: Array<{ re: RegExp; domains: string[]; roles: string[] }> = [
  // —— 高特异性优先 ——
  { re: /^(psql|mysql|sqlite|redis|mongo|sql)(?:$|[-_.:])/, domains: ['db'], roles: ['operator'] },
  { re: /^(browser|playwright|puppeteer|selenium)(?:$|[-_.:])/, domains: ['browser'], roles: ['researcher'] },
  { re: /^(md5|sha\d*|hash|cert|sign|base64|openssl)(?:$|[-_.:])/, domains: ['crypto'], roles: ['verifier'] },
  { re: /^(git|gh)(?:$|[-_.:])/, domains: ['git'], roles: ['developer'] },
  { re: /^(docker|kubectl|k8s|helm)(?:$|[-_.:])/, domains: ['container', 'deploy'], roles: ['operator'] },
  { re: /^(curl|wget|ping|ssh|scp|http|fetch)(?:$|[-_.:])/, domains: ['net'], roles: ['operator', 'researcher'] },
  { re: /^(npm|pnpm|yarn|node|bun|tsc|vite|esbuild|webpack)(?:$|[-_.:])/, domains: ['build'], roles: ['developer'] },
  { re: /^(python3?|pip|pytest|uv|poetry)(?:$|[-_.:])/, domains: ['code'], roles: ['developer'] },
  { re: /^(cargo|rustc|mvn|gradle)(?:$|[-_.:])/, domains: ['build'], roles: ['developer'] },
  { re: /^go(?:$|[-_.:])/, domains: ['build'], roles: ['developer'] },
  { re: /^(grep|rg|search|ag|ack)(?:$|[-_.:])/, domains: ['search'], roles: ['developer'] },
  { re: /^(test|vitest|jest|mocha|coverage|lint|eslint|oxlint)(?:$|[-_.:])/, domains: ['test'], roles: ['verifier', 'developer'] },
  { re: /^(exec|shell|run|eval|bash|sh|cmd)(?:$|[-_.:])/, domains: ['shell'], roles: ['operator'] },
  // —— 较宽泛的兜底规则 ——
  { re: /^(ls|dir|tree|cat|pwd|cp|mv|rm|mkdir|rmdir|touch|find|findstr|head|tail|wc)(?:$|[-_.:])/, domains: ['fs'], roles: ['developer', 'verifier'] },
  { re: /^(env|set|export|whoami|date|ps|tasklist|systeminfo|version|stats)(?:$|[-_.:])/, domains: ['system'], roles: ['operator'] },
  { re: /^(help|clear|new|config|model|profiles|login|add-profile|del-profile)(?:$|[-_.:])/, domains: ['utility'], roles: ['developer'] },
  { re: /^(team|agent|plan|task)(?:$|[-_.:])/, domains: ['ai'], roles: ['developer'] },
]

/**
 * 风险与成本判定正则。
 * 同样要求命令名边界收尾：`del` 不应匹配 `delta`，`run` 不应匹配 `runner`。
 */
const B = '(?:$|[-_.:])'
/**
 * 明确会写盘/改状态的高风险命令。
 * 注意 exec / eval / shell 这类「万能执行器」按 destructive 处理：它们能执行任意
 * 命令，风险上界等同于最危险的操作，不能因为命令名本身「只是运行」就判为只读。
 */
const DESTRUCTIVE_RE = new RegExp(
  `^(rm|rmdir|del|format|mkfs|dd|shutdown|reboot|kill|killall|taskkill|drop|truncate|reset)${B}` +
  `|^(exec|eval|shell|cmd|bash|sh|powershell|pwsh)${B}`
)
const WRITE_RE = new RegExp(`^(cp|mv|mkdir|touch|echo|tee|sed|patch)${B}|^(git)[-_.](commit|push|revert|reset|checkout)${B}|^(npm|pnpm|yarn|pip)[-_.](install|add|remove|uninstall)${B}`)
const NETWORK_RE = new RegExp(`^(curl|wget|ping|ssh|scp|http|fetch|nc|telnet)${B}|^(npm|pip)[-_.](install|publish)${B}|^(git)[-_.]clone${B}`)

/**
 * 高成本命令：通常耗时较长或输出量大。
 * 除「命令名本身」外，还要识别 `<构建器>-<动作>` 组合（cargo-build、npm-install 等），
 * 否则这些长任务会被当成 low cost，在预算淘汰时被错误优先保留。
 */
const HIGH_COST_RE = new RegExp(
  `^(build|compile|install|clone|deploy|docker|kubectl|mvn|gradle|test)${B}` +
  `|^(cargo|npm|pnpm|yarn|go|python|pip|mvn|gradle)[-_.](build|install|add|test|compile|publish)${B}`
)

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
