/**
 * engine/memory/memoryWriter.ts — 记忆写入器（记忆系统的写入侧）
 *
 * 与 `memoryRecall.ts`（读取侧）配对。设计来源：D:\src\memdir\ 与
 * D:\src\services\extractMemories\ —— 上游把「什么不该记」写成了硬规则，
 * 因为记忆一旦写错就会在后续每一轮被召回、持续污染判断。
 *
 * 三条纪律：
 * 1. **不保存黑名单**：代码结构/git 历史/调试配方一律拒收（见 REFUSE_RULES）
 * 2. **索引纪律**：MEMORY.md 每行是一条 ≤150 字符的指针，整体 ≤200 行
 * 3. **写入原子性**：tmp + rename，避免读到半截文件
 */

import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { resolveMemoryDir, type MemoryType } from './memoryRecall.ts'

// ─────────────────────────────── 常量 ───────────────────────────────

/** 索引单行最大字符数（超出则截断简介） */
export const MAX_INDEX_LINE_CHARS = 150
/** 索引最大行数 */
export const MAX_INDEX_LINES = 200
/** 索引最大字节数 */
export const MAX_INDEX_BYTES = 25_000
/** 单个记忆文件正文上限（超出拒绝写入，避免写入方无节制倾倒） */
export const MAX_MEMORY_BODY_CHARS = 8_000

// ─────────────────────────────── 类型 ───────────────────────────────

export interface MemoryWriteInput {
  /** 记忆标题（同时用作文件名基础） */
  name: string
  /** 单行描述：未来对话靠它判断相关性，要具体 */
  description: string
  type: MemoryType
  /** 正文 */
  body: string
  /** 关联标签（可选） */
  autoSkill?: string[]
}

export interface MemoryWriteResult {
  ok: boolean
  /** 成功时的文件名 */
  file?: string
  /** 失败原因 */
  reason?: string
}

// ─────────────────────────────── 不保存黑名单 ───────────────────────────────

interface RefuseRule {
  /** 规则名（用于报错） */
  id: string
  /** 命中即拒收 */
  test: (text: string) => boolean
  /** 给写入方的解释 */
  hint: string
}

/**
 * 不应写入记忆的内容。
 *
 * 判断依据：**这些信息能从当前代码库/git 直接查到**，存进记忆只会过期，
 * 而且会被反复召回、占用上下文。记忆应该只存「无法从代码推导」的东西
 * （用户偏好、项目背景、外部系统位置）。
 */
const REFUSE_RULES: RefuseRule[] = [
  {
    id: 'code-structure',
    test: t => /函数\s*[`'\w]+.*(?:定义在|位于|在)\s*(?:src|lib|dist)[\\/]/i.test(t),
    hint: '代码结构与文件路径可从代码库直接获得，不要写入记忆',
  },
  {
    id: 'git-history',
    test: t => /(?:提交|commit)\s*[0-9a-f]{7,40}/i.test(t) || /git log.*--oneline/i.test(t),
    hint: 'git 历史用 git log 查是权威来源，不要写入记忆',
  },
  {
    id: 'debug-recipe',
    test: t => /(?:修复|解决)方法[：:].*(?:改\s*第\s*\d+\s*行|把\s*\w+\s*改成)/i.test(t),
    hint: '具体的代码修改配方在代码里，不要写入记忆',
  },
  {
    id: 'temporary-state',
    // 数字与量词两种语序都要覆盖：「3 轮」与「轮 3」
    test: t =>
      /(?:正在进行|当前任务|待办|TODO)[：:].{0,40}(?:\d+\s*(?:轮|次|步|个)|(?:轮|次|步)\s*\d+)/i.test(t),
    hint: '临时任务进度会很快过期，不要写入记忆',
  },
]

/** 检测密钥/凭据：一旦写进记忆会被反复召回，风险极高 */
const SECRET_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: 'openai-key', re: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { id: 'anthropic-key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { id: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { id: 'aws-key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { id: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { id: 'bearer', re: /Authorization:\s*Bearer\s+[A-Za-z0-9._-]{20,}/i },
]

/** 检查是否为不应写入的内容；返回拒绝原因，通过则返回 null */
export function checkWritable(input: MemoryWriteInput): string | null {
  if (!input.name || !input.name.trim()) return '缺少 name'
  if (!input.description || !input.description.trim()) return '缺少 description（索引靠它判断相关性）'
  if (!input.body || !input.body.trim()) return '正文为空'
  if (input.body.length > MAX_MEMORY_BODY_CHARS) {
    return `正文过长（${input.body.length} > ${MAX_MEMORY_BODY_CHARS} 字符），请精简后再写入`
  }

  const all = `${input.name}\n${input.description}\n${input.body}`
  for (const rule of REFUSE_RULES) {
    if (rule.test(all)) return `拒收（${rule.id}）：${rule.hint}`
  }
  for (const s of SECRET_PATTERNS) {
    if (s.re.test(all)) return `拒收：检测到疑似凭据（${s.id}）。凭据不得写入记忆`
  }
  return null
}

// ─────────────────────────────── 文件名与序列化 ───────────────────────────────

/** 由标题生成安全文件名（保留可读性，去掉路径危险字符） */
export function toMemoryFileName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[\s/\\:*?"<>|]+/g, '-')
    .replace(/\.+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
  return `${base || 'memory'}.md`
}

function serialize(input: MemoryWriteInput): string {
  const fm = [
    '---',
    `name: ${input.name.trim()}`,
    `description: ${input.description.trim()}`,
    `type: ${input.type}`,
  ]
  if (input.autoSkill && input.autoSkill.length > 0) {
    fm.push(`autoSkill: ${input.autoSkill.join(', ')}`)
  }
  fm.push('---', '')
  return `${fm.join('\n')}\n${input.body.trim()}\n`
}

/** 原子写入：先写 tmp 再 rename，避免读到半截内容 */
async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tmp, content, 'utf-8')
  try {
    await fs.rename(tmp, filePath)
  } catch (e) {
    await fs.unlink(tmp).catch(() => {})
    throw e
  }
}

// ─────────────────────────────── 索引维护 ───────────────────────────────

function indexLine(name: string, file: string, description: string): string {
  const desc = description.replace(/\s+/g, ' ').trim()
  let line = `- [${name}](${file}) — ${desc}`
  if (line.length > MAX_INDEX_LINE_CHARS) {
    line = `${line.slice(0, MAX_INDEX_LINE_CHARS - 1)}…`
  }
  return line
}

/**
 * 更新 MEMORY.md 索引。
 *
 * 口径（对齐上游 MAX_ENTRYPOINT_*）：
 * - 已存在指向同一文件的条目 → 原地替换（不重复追加）
 * - 超过行数/字节上限 → 从头截断，保留警告说明
 */
export async function updateMemoryIndex(
  memoryDir: string,
  name: string,
  file: string,
  description: string,
): Promise<void> {
  const indexPath = path.join(memoryDir, 'MEMORY.md')
  let lines: string[] = []
  try {
    const raw = await fs.readFile(indexPath, 'utf-8')
    lines = raw.split('\n')
  } catch {
    lines = ['# MEMORY', '']
  }

  // 确保有标题
  if (!lines.some(l => l.trim().startsWith('#'))) {
    lines.unshift('# MEMORY', '')
  }

  const marker = `](${file})`
  const newLine = indexLine(name, file, description)
  const existingIdx = lines.findIndex(l => l.includes(marker))
  if (existingIdx >= 0) {
    lines[existingIdx] = newLine
  } else {
    // 追加到末尾（跳过尾部空行）
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()
    lines.push(newLine, '')
  }

  // 行数上限：从头截断（保留标题）
  const header = lines.slice(0, 2)
  const entries = lines.slice(2).filter(l => l.trim())
  if (entries.length > MAX_INDEX_LINES) {
    const kept = entries.slice(entries.length - MAX_INDEX_LINES)
    lines = [...header, '', ...kept, '', `<!-- 索引超过 ${MAX_INDEX_LINES} 条，旧的条目已截断 -->`]
  }

  // 字节上限
  let text = lines.join('\n')
  while (Buffer.byteLength(text, 'utf8') > MAX_INDEX_BYTES && lines.length > 4) {
    // 从最旧的一条开始丢（保留标题两行）
    const dropIdx = lines.findIndex((l, i) => i >= 2 && l.trim().startsWith('- ['))
    if (dropIdx < 0) break
    lines.splice(dropIdx, 1)
    text = lines.join('\n')
  }

  await atomicWrite(indexPath, text)
}

// ─────────────────────────────── 主入口 ───────────────────────────────

export interface WriteMemoryOptions {
  memoryDir?: string
  /** 已存在同名文件时是否覆盖；默认 true（视为更新） */
  overwrite?: boolean
}

/**
 * 写入一条记忆并同步更新索引。
 *
 * 这是记忆系统的唯一写入口 —— 所有写入都经过黑名单与密钥检查，
 * 避免把「能查到的东西」或凭据沉淀成跨对话污染源。
 */
export async function writeMemory(
  input: MemoryWriteInput,
  opts: WriteMemoryOptions = {},
): Promise<MemoryWriteResult> {
  const reason = checkWritable(input)
  if (reason) return { ok: false, reason }

  const memoryDir = opts.memoryDir ?? resolveMemoryDir()
  const file = toMemoryFileName(input.name)
  const filePath = path.join(memoryDir, file)

  // 路径安全：文件名由 toMemoryFileName 生成，这里再确认一次没跑出目录
  if (path.dirname(path.resolve(filePath)) !== path.resolve(memoryDir)) {
    return { ok: false, reason: '文件名非法，拒绝写入' }
  }

  try {
    await fs.mkdir(memoryDir, { recursive: true })
    if (opts.overwrite === false) {
      try {
        await fs.access(filePath)
        return { ok: false, reason: `同名记忆已存在：${file}` }
      } catch {
        // 不存在，继续
      }
    }
    await atomicWrite(filePath, serialize(input))
    await updateMemoryIndex(memoryDir, input.name.trim(), file, input.description)
    return { ok: true, file }
  } catch (e) {
    return { ok: false, reason: `写入失败: ${(e as Error).message}` }
  }
}

/**
 * 判断某段文本是否值得作为记忆留存（廉价预筛）。
 *
 * 用于「回合结束后台提取」的入口判断：明显不该记的内容直接跳过，
 * 不必再花一次模型调用去提炼。
 */
export function looksWorthRemembering(text: string): boolean {
  if (!text || text.trim().length < 40) return false
  // 命中黑名单的一律不值得
  for (const rule of REFUSE_RULES) {
    if (rule.test(text)) return false
  }
  for (const s of SECRET_PATTERNS) {
    if (s.re.test(text)) return false
  }
  // 需要出现「跨对话仍然有用」的信号词
  return /(记住|以后|下次|约定|偏好|惯例|规范|注意|不要再|避免|总是|从不|项目背景|外部|地址|地址在|位于\s*http)/.test(text)
}
