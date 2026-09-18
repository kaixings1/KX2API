/**
 * main/permissions/permissionConfig.ts — 权限规则的配置加载
 *
 * 与 `main/hooks/hookConfig.ts` 同构：配置固定在 userData 下，
 * 不接受项目目录里的定义（同样的安全理由 —— 克隆一个仓库不该改变你的权限策略）。
 *
 * ─────────────────────────────────────────────────────────────
 * 为什么配置文件用「规则字符串」而不是结构化对象
 * ─────────────────────────────────────────────────────────────
 * 用户手写配置时，`"Bash(git status)"` 比
 * `{"toolName":"Bash","ruleContent":"git status"}` 直观得多。
 * 解析走 `permissionRuleValueFromString`（含转义处理），
 * 落盘时再序列化回去 —— 往返一致由单元测试保证。
 */

import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import {
  permissionRuleValueFromString,
  permissionRuleValueToString,
  type PermissionBehavior,
  type PermissionRule,
  type PermissionRuleSource,
} from '../../engine/permissions/permissionRules.ts'

/** 配置文件里单条规则的形状 */
export interface PermissionRuleEntry {
  /** 裁决：allow / deny / ask */
  behavior: Exclude<PermissionBehavior, 'passthrough'>
  /** 规则字符串，如 "Bash(git status)"、"Edit(src/**)" */
  rule: string
  /** 来源，缺省 userSettings；用于优先级判定 */
  source?: PermissionRuleSource
}

export interface PermissionConfigFile {
  version: 1
  rules: PermissionRuleEntry[]
  /**
   * 未命中任何规则时的默认裁决。
   * 缺省 `passthrough`（交回既有权限逻辑）—— 保持改造前行为。
   */
  defaultBehavior?: PermissionBehavior
}

let configPath: string | null = null
let cached: PermissionRule[] | null = null

/** 设置配置路径（主进程启动时调用；测试也用它指向临时文件） */
export function setPermissionConfigPath(p: string | null): void {
  configPath = p
  cached = null
}

export function getPermissionConfigPath(): string | null {
  return configPath
}

/** 清空缓存（改完配置即时生效） */
export function clearPermissionConfigCache(): void {
  cached = null
}

/**
 * 工具名合法性。
 *
 * 允许字母/数字/下划线开头，后续可含 `.-:/*`（MCP 风格与通配）。
 *
 * 这条校验是必需的 —— `permissionRuleValueFromString` 对畸形输入采取
 * 「退化为整串当工具名」的保守策略（防抛错），于是一条写错的配置
 * （如写成了 `"(foo)"`）会变成一条名为 `(foo)` 的无效规则静默留在规则集里。
 * 配置层应比解析层更严格：**写错的规则直接跳过并告警**。
 */
const VALID_TOOL_NAME_RE = /^[A-Za-z_][\w.\-:/*]*$/

/**
 * 把配置条目解析成规则对象。
 *
 * 畸形条目**跳过而非抛错** —— 一条写错的规则不该让整套权限配置失效
 * （那会让用户"改了配置后权限突然全放开/全锁死"，很难排查）。
 */
export function parsePermissionEntries(entries: readonly PermissionRuleEntry[]): PermissionRule[] {
  const out: PermissionRule[] = []
  if (!Array.isArray(entries)) return out

  for (const e of entries) {
    if (!e || typeof e.rule !== 'string' || !e.rule.trim()) continue
    const behavior = e.behavior
    if (behavior !== 'allow' && behavior !== 'deny' && behavior !== 'ask') {
      console.warn(`[Permissions] 未知裁决，已跳过: ${String(behavior)}`)
      continue
    }
    const value = permissionRuleValueFromString(e.rule)
    if (!value.toolName || !VALID_TOOL_NAME_RE.test(value.toolName)) {
      console.warn(`[Permissions] 规则无法解析出合法工具名，已跳过: ${e.rule}`)
      continue
    }
    out.push({ source: e.source ?? 'userSettings', behavior, value })
  }
  return out
}

/**
 * 读取权限规则。
 *
 * 失败一律降级为空规则集（= 完全不影响既有权限逻辑）——
 * 权限是安全相关的，但"配置读不出来"不该变成"一律拒绝"或"一律放行"，
 * 而应回到代码里既有的判定路径。
 */
export async function loadPermissionRules(force = false): Promise<PermissionRule[]> {
  if (!force && cached) return cached
  if (!configPath) {
    cached = []
    return cached
  }

  try {
    const raw = await fs.readFile(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as PermissionConfigFile
    cached = parsePermissionEntries(parsed?.rules ?? [])
    if (cached.length > 0) {
      console.log(`[Permissions] 已加载 ${cached.length} 条规则`)
    }
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') {
      console.warn('[Permissions] 配置读取失败，按无规则处理:', (e as Error).message)
    }
    cached = []
  }
  return cached
}

/** 写入规则（设置界面用）。以「规则字符串」形式落盘，便于用户手工编辑 */
export async function writePermissionRules(
  entries: readonly PermissionRuleEntry[],
): Promise<void> {
  if (!configPath) throw new Error('权限配置路径未设置')
  const payload: PermissionConfigFile = {
    version: 1,
    rules: entries.map(e => ({
      behavior: e.behavior,
      rule: e.rule,
      ...(e.source ? { source: e.source } : {}),
    })),
  }
  await fs.mkdir(path.dirname(configPath), { recursive: true })
  await fs.writeFile(configPath, JSON.stringify(payload, null, 2), 'utf-8')
  clearPermissionConfigCache()
}

/** 把规则对象转回配置文件条目（供 UI 编辑后保存） */
export function rulesToEntries(rules: readonly PermissionRule[]): PermissionRuleEntry[] {
  const out: PermissionRuleEntry[] = []
  for (const r of rules) {
    if (r.behavior === 'passthrough') continue
    out.push({
      behavior: r.behavior,
      rule: permissionRuleValueToString(r.value),
      source: r.source,
    })
  }
  return out
}

/**
 * 首次启动时写入一份示例配置，方便用户上手。
 *
 * 只在配置文件**不存在**时写，绝不覆盖用户已有的规则。
 * 示例全部是注释性的安全规则，不会突然改变用户的操作体验。
 */
export async function ensureSamplePermissionConfig(): Promise<boolean> {
  if (!configPath) return false
  try {
    await fs.access(configPath)
    return false // 已存在，不覆盖
  } catch {
    /* 不存在，写入示例 */
  }
  try {
    const sample: PermissionConfigFile = {
      version: 1,
      rules: [
        // 只读类操作默认放行。
        // 注意：这里用的是**注册命令名**（cat/ls/find），与实际生效的工具名一致；
        // 早期示例写的是 Claude 风格名（Read/Glob/Grep），照抄不会命中任何工具。
        { behavior: 'allow', rule: 'cat' },
        { behavior: 'allow', rule: 'ls' },
        { behavior: 'allow', rule: 'find' },
        // 危险命令每次询问（不是直接拒绝，用户仍可确认后执行）
        { behavior: 'ask', rule: 'bash(rm **)' },
        { behavior: 'ask', rule: 'bash(git push **)' },
        { behavior: 'ask', rule: 'bash(npm publish **)' },
      ],
    }
    await fs.mkdir(path.dirname(configPath), { recursive: true })
    await fs.writeFile(configPath, JSON.stringify(sample, null, 2), 'utf-8')
    clearPermissionConfigCache()
    console.log('[Permissions] 已写入示例配置:', configPath)
    return true
  } catch (e) {
    console.warn('[Permissions] 写入示例配置失败:', (e as Error).message)
    return false
  }
}
