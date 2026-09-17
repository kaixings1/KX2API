/**
 * main/hooks/hookConfig.ts — 钩子配置的加载与匹配
 *
 * ─────────────────────────────────────────────────────────────
 * 安全边界（刻意与上游不同的一处设计）
 * ─────────────────────────────────────────────────────────────
 * 钩子会执行**任意 shell 命令**。上游 Claude Code 允许项目级
 * `.claude/settings.json` 定义钩子 —— 这意味着克隆一个仓库就可能执行其中
 * 埋好的命令。
 *
 * 本项目**只从用户的 userData 目录读取配置**（`<userData>/hooks.json`），
 * 不接受来自项目目录的钩子定义。用户如果要为某项目配置钩子，手动抄进自己的
 * 配置文件即可 —— 这一步人工确认本身就是安全边界。
 */

import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { isHookEvent, type HookContext, type HookEvent, type HookMatcher, type HooksConfig } from './types.ts'

/** 配置文件路径（由主进程启动时注入 userData） */
let configPath: string | null = null

/** 覆盖配置路径（主进程初始化时调用；测试也用它指向临时文件） */
export function setHooksConfigPath(p: string | null): void {
  configPath = p
  cachedConfig = null
}

export function getHooksConfigPath(): string | null {
  return configPath
}

let cachedConfig: HooksConfig | null = null

/** 清空配置缓存（改完配置即时生效） */
export function clearHooksConfigCache(): void {
  cachedConfig = null
}

/**
 * 读取配置。
 *
 * 失败一律降级为「无钩子」—— 钩子是增强项，配置损坏不应阻断主流程。
 */
export async function loadHooksConfig(force = false): Promise<HooksConfig> {
  if (!force && cachedConfig) return cachedConfig
  if (!configPath) {
    // 未配置路径与「读取失败」语义相同：都没有钩子可跑。
    // 返回结构保持一致，避免调用方拿到的形状随路径变。
    cachedConfig = { hooks: {} }
    return cachedConfig
  }

  try {
    const raw = await fs.readFile(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as HooksConfig
    cachedConfig = sanitizeConfig(parsed)
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') {
      console.warn('[Hooks] 配置读取失败，按无钩子处理:', (e as Error).message)
    }
    cachedConfig = { hooks: {} }
  }
  return cachedConfig
}

/** 过滤掉结构非法的条目，避免运行时才炸 */
function sanitizeConfig(cfg: HooksConfig): HooksConfig {
  const out: HooksConfig = { hooks: {} }
  const hooks = cfg?.hooks
  if (!hooks || typeof hooks !== 'object') return out

  for (const [event, matchers] of Object.entries(hooks)) {
    if (!isHookEvent(event)) {
      console.warn(`[Hooks] 未知事件名，已忽略: ${event}`)
      continue
    }
    if (!Array.isArray(matchers)) continue
    const valid: HookMatcher[] = []
    for (const m of matchers) {
      if (!m || !Array.isArray(m.hooks)) continue
      const commands = m.hooks.filter(
        h => h && h.type === 'command' && typeof h.command === 'string' && h.command.trim(),
      )
      if (commands.length === 0) continue
      valid.push({ matcher: m.matcher, hooks: commands })
    }
    if (valid.length > 0) out.hooks![event] = valid
  }
  return out
}

/** 解析 matcher 正则；非法或空视为「匹配全部」 */
function compileMatcher(pattern?: string): RegExp | null {
  if (!pattern || pattern === '*' || !pattern.trim()) return null
  try {
    return new RegExp(pattern, 'i')
  } catch {
    console.warn(`[Hooks] matcher 不是合法正则，按匹配全部处理: ${pattern}`)
    return null
  }
}

/**
 * 取出某个事件下匹配当前上下文的所有钩子命令。
 * 返回顺序即配置顺序 —— 调用方并行执行，不依赖顺序。
 */
export async function getMatchingHooks(ctx: HookContext): Promise<Array<{ matcher?: string; command: string; timeout?: number }>> {
  const cfg = await loadHooksConfig()
  const matchers = cfg.hooks?.[ctx.event]
  if (!matchers || matchers.length === 0) return []

  const out: Array<{ matcher?: string; command: string; timeout?: number }> = []
  for (const m of matchers) {
    const re = compileMatcher(m.matcher)
    if (re && (ctx.matchKey == null || !re.test(ctx.matchKey))) continue
    for (const h of m.hooks) {
      out.push({ matcher: m.matcher, command: h.command, timeout: h.timeout })
    }
  }
  return out
}

/** 某事件是否配置了钩子（用于跳过昂贵的上下文准备） */
export async function hasHooksFor(event: HookEvent): Promise<boolean> {
  const cfg = await loadHooksConfig()
  const m = cfg.hooks?.[event]
  return !!m && m.length > 0
}

/**
 * 写入配置文件（设置界面用）。保留其余字段。
 */
export async function writeHooksConfig(cfg: HooksConfig): Promise<void> {
  if (!configPath) throw new Error('hooks 配置路径未设置')
  await fs.mkdir(path.dirname(configPath), { recursive: true })
  await fs.writeFile(configPath, JSON.stringify(cfg, null, 2), 'utf-8')
  clearHooksConfigCache()
}
