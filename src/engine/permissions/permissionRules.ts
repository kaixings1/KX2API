/**
 * engine/permissions/permissionRules.ts — 权限规则
 *
 * 移植自 D:\src\utils\permissions\permissionRuleParser.ts + PermissionRule.ts。
 *
 * ─────────────────────────────────────────────────────────────
 * 解决什么问题
 * ─────────────────────────────────────────────────────────────
 * KX2API 原有的权限判定只有"工具级"粒度 —— 要么整个工具放行，要么整个拒绝。
 * 但真实场景需要更细：
 *   - 允许 `git status/log/diff`，但每次都问 `git push`
 *   - 允许读 `src/**`，但拒绝读 `.env`
 *
 * 规则字符串承载参数级语义：`Bash(git status)`、`Edit(src/**)`、`mcp__fs__*`。
 *
 * ─────────────────────────────────────────────────────────────
 * 转义为什么必须存在
 * ─────────────────────────────────────────────────────────────
 * 规则格式是 `工具名(内容)`，那么内容本身含括号时就会解析歧义：
 *   `Bash(python -c "print(1)")` ← 哪个括号是规则的分隔符？
 * 因此内容里的 `(` `)` `\` 必须转义。**转义与反转义的顺序都不能颠倒**：
 * 转义时先处理反斜杠（否则会把刚加上的转义符再转义一次），
 * 反转义时反序（先还原括号，最后还原反斜杠）。
 */

// 跨写法工具名兼容：注册名（bash/cat/ls）与历史风格名（Bash/Read/ListFiles）
// 指向同一工具时，规则匹配必须能识别 —— 见 ruleApplies 中的说明。
import { isSameTool } from '../toolNameCompat.ts'

// ─────────────────────────────── 类型 ───────────────────────────────

/** 权限裁决三态 + 透传（工具不表态，交给通用逻辑） */
export type PermissionBehavior = 'allow' | 'deny' | 'ask' | 'passthrough'

export interface PermissionRuleValue {
  toolName: string
  /** 参数级约束；省略表示"该工具整体" */
  ruleContent?: string
}

/**
 * 规则来源。顺序即优先级（后者覆盖前者）。
 *
 * `session` 是"允许一次"的落点；`localSettings` / `projectSettings` 是"永远允许"。
 */
export type PermissionRuleSource =
  | 'policySettings'
  | 'userSettings'
  | 'projectSettings'
  | 'localSettings'
  | 'cliArg'
  | 'session'

/** 来源优先级（数值越大越优先） */
const SOURCE_PRIORITY: Record<PermissionRuleSource, number> = {
  policySettings: 0,
  userSettings: 1,
  projectSettings: 2,
  localSettings: 3,
  cliArg: 4,
  session: 5,
}

export interface PermissionRule {
  source: PermissionRuleSource
  behavior: PermissionBehavior
  value: PermissionRuleValue
}

/**
 * 旧工具名 → 当前正式名。
 *
 * 工具改名后，用户此前保存的规则、hooks 配置、持久化记录里仍是旧名。
 * 没有这张表，用户升级后会发现"之前配好的规则突然不生效了"。
 */
const LEGACY_TOOL_NAME_ALIASES: Record<string, string> = {
  // ── 工具改名的历史别名（原有）──
  Task: 'Agent',
  KillShell: 'TaskStop',
  AgentOutputTool: 'TaskOutput',
  BashOutputTool: 'TaskOutput',

}

export function normalizeLegacyToolName(name: string): string {
  return LEGACY_TOOL_NAME_ALIASES[name] ?? name
}

/** 反查某正式名对应的所有旧名（迁移/提示用） */
export function getLegacyToolNames(canonicalName: string): string[] {
  const out: string[] = []
  for (const [legacy, canonical] of Object.entries(LEGACY_TOOL_NAME_ALIASES)) {
    if (canonical === canonicalName) out.push(legacy)
  }
  return out
}

// ─────────────────────────────── 转义 ───────────────────────────────

/**
 * 转义规则内容。
 * 顺序不可颠倒：先反斜杠，再括号。
 */
export function escapeRuleContent(content: string): string {
  return content
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

/**
 * 反转义规则内容。顺序是转义的**逆序**：先括号，后反斜杠。
 */
export function unescapeRuleContent(content: string): string {
  return content
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
}

// ─────────────────────────────── 括号定位 ───────────────────────────────

/**
 * 找一个**未被转义**的字符位置。
 * 转义判定：其前面连续反斜杠数量为奇数即视为已转义。
 */
function findUnescaped(str: string, char: string, fromEnd: boolean): number {
  const start = fromEnd ? str.length - 1 : 0
  const end = fromEnd ? -1 : str.length
  const step = fromEnd ? -1 : 1
  for (let i = start; i !== end; i += step) {
    if (str[i] !== char) continue
    let backslashes = 0
    let j = i - 1
    while (j >= 0 && str[j] === '\\') {
      backslashes++
      j--
    }
    if (backslashes % 2 === 0) return i
  }
  return -1
}

// ─────────────────────────────── 解析 / 序列化 ───────────────────────────────

/**
 * 解析规则字符串。
 *
 * 畸形输入一律**退化**为工具级规则（而不是抛错）——
 * 权限解析失败时宁可放宽粒度，也不能让整个权限系统崩掉。
 */
export function permissionRuleValueFromString(ruleString: string): PermissionRuleValue {
  const raw = (ruleString ?? '').trim()
  if (!raw) return { toolName: '' }

  const open = findUnescaped(raw, '(', false)
  if (open === -1) return { toolName: normalizeLegacyToolName(raw) }

  const close = findUnescaped(raw, ')', true)
  // 括号不配对、或闭合括号不在末尾 → 整串当工具名
  if (close === -1 || close <= open || close !== raw.length - 1) {
    return { toolName: normalizeLegacyToolName(raw) }
  }

  const toolName = raw.substring(0, open)
  if (!toolName) return { toolName: normalizeLegacyToolName(raw) }

  const rawContent = raw.substring(open + 1, close)
  // `Bash()` / `Bash(*)` 等价于工具级规则
  if (rawContent === '' || rawContent === '*') {
    return { toolName: normalizeLegacyToolName(toolName) }
  }

  return { toolName: normalizeLegacyToolName(toolName), ruleContent: unescapeRuleContent(rawContent) }
}

/** 序列化规则；内容里的括号会被转义 */
export function permissionRuleValueToString(value: PermissionRuleValue): string {
  if (!value.ruleContent) return value.toolName
  return `${value.toolName}(${escapeRuleContent(value.ruleContent)})`
}

// ─────────────────────────────── 内容匹配 ───────────────────────────────

/** glob 转正则的缓存（规则内容重复出现，避免反复编译） */
const globCache = new Map<string, RegExp>()
const GLOB_CACHE_MAX = 500

/**
 * 把 glob 模式转成正则。
 *
 * - `*`  匹配任意字符但**不跨分隔符**（`/` 与空白）
 * - `**` 匹配任意字符（跨分隔符）
 * - `?`  匹配单个非分隔符字符
 * - 其余字符字面匹配
 *
 * 不跨分隔符这点很重要：`git *` 应该匹配 `git status`，
 * 但 `*` 若跨空白就会匹配 `git push --force origin main` 这种任意长命令，
 * 让"只允许 git status"的意图落空。
 */
function globToRegExp(pattern: string): RegExp {
  const cached = globCache.get(pattern)
  if (cached) return cached

  let out = '^'
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        out += '[\\s\\S]*'
        i++
      } else {
        out += '[^\\s/\\\\]*'
      }
    } else if (c === '?') {
      out += '[^\\s/\\\\]'
    } else {
      out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    }
  }
  out += '$'

  const re = new RegExp(out)
  if (globCache.size >= GLOB_CACHE_MAX) globCache.clear()
  globCache.set(pattern, re)
  return re
}

/**
 * 规则内容是否匹配给定的实际输入。
 *
 * 匹配顺序：精确相等 → glob。
 * 精确优先是刻意的 —— 让 `Bash(npm test)` 这类规则不受 glob 语义影响。
 */
export function matchesRuleContent(ruleContent: string, input: string): boolean {
  if (ruleContent === input) return true
  if (!ruleContent.includes('*') && !ruleContent.includes('?')) return false
  try {
    return globToRegExp(ruleContent).test(input)
  } catch {
    return false
  }
}

/**
 * 从工具输入中提取用于规则匹配的字符串。
 *
 * 不同工具的"参数"含义不同，这里做统一抽取：
 * - 有 `command` 字段（Bash/Shell）→ 用命令
 * - 有 `path` / `file_path`（Read/Edit/Write）→ 用路径
 * - 否则退化为把输入序列化（保证 `ToolName(子串)` 至少能匹配到）
 */
export function extractRuleSubject(toolName: string, input: unknown): string {
  if (input == null) return ''
  if (typeof input === 'string') return input
  if (typeof input !== 'object') return String(input)

  const obj = input as Record<string, unknown>
  for (const key of ['command', 'path', 'file_path', 'filePath', 'url', 'pattern']) {
    const v = obj[key]
    if (typeof v === 'string' && v) return v
  }

  try {
    return JSON.stringify(input)
  } catch {
    return ''
  }
}

/** 规则是否适用于某次工具调用 */
export function ruleApplies(
  rule: PermissionRule,
  toolName: string,
  input: unknown,
): boolean {
  const ruleTool = normalizeLegacyToolName(rule.value.toolName)
  const actualTool = normalizeLegacyToolName(toolName)

  // MCP 风格的 `mcp__server__*` 允许前缀通配整个服务器
  if (ruleTool.includes('*')) {
    if (!matchesRuleContent(ruleTool, actualTool)) return false
  } else if (ruleTool !== actualTool) {
    // 名字不字面相等时，再按「是否同一个工具」判定一次。
    //
    // 原因：本项目里同一工具存在两种写法 —— 注册命令名（bash/cat/ls/find，
    // 实际被调度的名字）与历史风格名（Bash/Read/ListFiles/Glob，用户在
    // 配置文件与设置页里写的名字）。二者若只做字面比较，规则永远不命中，
    // 表现为「配了规则却不生效」。
    //
    // 这里只放宽**工具是否同一**这一层；下面的 ruleContent 匹配仍严格按
    // 用户写的内容执行，不改变权限语义的粒度。
    if (!isSameTool(ruleTool, actualTool)) return false
  }

  // 无内容约束 = 该工具整体的规则
  if (!rule.value.ruleContent) return true

  return matchesRuleContent(rule.value.ruleContent, extractRuleSubject(actualTool, input))
}

// ─────────────────────────────── 判定 ───────────────────────────────

export interface PermissionDecision {
  behavior: PermissionBehavior
  /** 命中的规则（用于向用户解释"为什么被拒"） */
  matchedRule?: PermissionRule
}

/**
 * 按一组规则裁决一次工具调用。
 *
 * 优先级规则：
 * 1. **deny 永远优先** —— 任何一条规则拒绝就拒绝，不能被更宽松的规则覆盖。
 *    这是安全底线：用户明确拒绝过的东西，不该因为另一条 allow 规则而放行。
 * 2. 其次看来源优先级（session > cliArg > local > project > user > policy），
 *    越"靠近当前会话"的规则越优先。
 * 3. 同来源同行为时，**内容更具体的优先**（带 ruleContent 的优先于工具级的）。
 *
 * 无任何规则命中时返回 `passthrough`，交由上层的通用权限逻辑决定。
 */
export function evaluatePermission(
  rules: readonly PermissionRule[],
  toolName: string,
  input: unknown,
): PermissionDecision {
  const applicable = rules.filter(r => ruleApplies(r, toolName, input))
  if (applicable.length === 0) return { behavior: 'passthrough' }

  // 1. deny 绝对优先
  const denies = applicable.filter(r => r.behavior === 'deny')
  if (denies.length > 0) {
    return { behavior: 'deny', matchedRule: pickMostSpecific(denies) }
  }

  // 2. 其余按来源优先级，再按具体程度
  const rest = [...applicable].sort((a, b) => {
    const sp = SOURCE_PRIORITY[b.source] - SOURCE_PRIORITY[a.source]
    if (sp !== 0) return sp
    return specificity(b) - specificity(a)
  })

  return { behavior: rest[0].behavior, matchedRule: rest[0] }
}

/** 具体程度：带内容约束的规则比工具级更具体 */
function specificity(rule: PermissionRule): number {
  return rule.value.ruleContent ? 1 : 0
}

function pickMostSpecific(rules: PermissionRule[]): PermissionRule {
  return [...rules].sort((a, b) => specificity(b) - specificity(a))[0]
}

// ─────────────────────────────── 记忆化授权 ───────────────────────────────

/**
 * 权限变更建议。
 *
 * 把"记住这次选择"建模成建议列表，UI 只需渲染并落盘 ——
 * 这样「允许一次」与「永远允许」的差别就只是 `destination` 不同，
 * 不需要在 UI 里写两套逻辑。
 */
export interface PermissionUpdate {
  type: 'addRules' | 'removeRules'
  destination: PermissionRuleSource
  rules: PermissionRuleValue[]
}

/** 「允许一次」：只写进当前会话 */
export function buildSessionAllow(toolName: string, ruleContent?: string): PermissionUpdate {
  return {
    type: 'addRules',
    destination: 'session',
    rules: [{ toolName, ruleContent }],
  }
}

/** 「永远允许」：写进用户配置 */
export function buildUserAllow(toolName: string, ruleContent?: string): PermissionUpdate {
  return {
    type: 'addRules',
    destination: 'userSettings',
    rules: [{ toolName, ruleContent }],
  }
}

/** 「永远拒绝」 */
export function buildUserDeny(toolName: string, ruleContent?: string): PermissionUpdate {
  return {
    type: 'addRules',
    destination: 'userSettings',
    rules: [{ toolName, ruleContent }],
  }
}

/** 把建议应用到规则列表（纯函数，返回新数组） */
export function applyPermissionUpdate(
  rules: readonly PermissionRule[],
  update: PermissionUpdate,
  behavior: PermissionBehavior,
): PermissionRule[] {
  const next = [...rules]
  for (const value of update.rules) {
    if (update.type === 'addRules') {
      next.push({ source: update.destination, behavior, value })
    } else {
      const idx = next.findIndex(
        r =>
          r.source === update.destination &&
          normalizeLegacyToolName(r.value.toolName) === normalizeLegacyToolName(value.toolName) &&
          r.value.ruleContent === value.ruleContent,
      )
      if (idx >= 0) next.splice(idx, 1)
    }
  }
  return next
}

/**
 * 生成可读的规则说明（UI 与错误提示用）。
 * 例：`Bash 命令匹配 "git status"`
 */
export function explainRule(rule: PermissionRule): string {
  const tool = normalizeLegacyToolName(rule.value.toolName)
  if (!rule.value.ruleContent) return `${tool}（该工具全部操作）`
  return `${tool} 匹配 "${rule.value.ruleContent}"`
}
