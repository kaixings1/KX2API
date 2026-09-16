/**
 * engine/memory/memoryRecall.ts — 记忆召回（吸收自 Claude Code 的 memdir 记忆系统）
 *
 * 设计来源：D:\src\memdir\（memoryScan.ts / findRelevantMemories.ts / memoryAge.ts / paths.ts）
 * 移植要点：
 * - 记忆文件 = Markdown + YAML frontmatter（name / description / type）
 * - 目录布局 <base>/projects/<sanitizePath(项目根)>/memory/，与 KX2API 既有约定同构
 * - 检索是「关键词预排序」而非向量：先只读每个文件前若干行拿 frontmatter，
 *   再按 skill/关键词重叠打分取 TopN，最后才读正文 —— 避免全量读盘
 * - 正文注入前做三重预算：单文件行数、单文件字节数、会话累计字节数
 * - 老化提示：文件多久没改，超过 1 天就在注入时附「内容可能已过时」提醒
 *
 * 刻意不移植：teamMemorySync（绑定 Anthropic 服务端 API）、LLM 选择器
 * （需要额外一次模型调用，收益不足以抵消延迟）。
 */

import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { homedir } from 'node:os'

// ─────────────────────────────── 常量 ───────────────────────────────

/** 单次注入最多带入的记忆文件数 */
const MAX_MEMORIES_PER_TURN = 5
/** 单个记忆文件最多读取的行数 */
const MAX_LINES_PER_MEMORY = 200
/** 单个记忆文件最多注入的字节数 */
const MAX_BYTES_PER_MEMORY = 4096
/** 扫描阶段每个文件只读前 N 行解析 frontmatter */
const FRONTMATTER_SCAN_LINES = 30
/** 参与打分的候选文件上限（避免超大记忆目录拖慢每轮请求） */
const MAX_SCAN_FILES = 200
/** 低于该分数视为不相关 */
const MIN_RELEVANCE_SCORE = 1

// ─────────────────────────────── 类型 ───────────────────────────────

export type MemoryType = 'user' | 'feedback' | 'project' | 'reference'

export interface MemoryEntry {
  /** 文件名（不含目录） */
  file: string
  /** 绝对路径 */
  absPath: string
  name: string
  description: string
  type: MemoryType | undefined
  /** 最后修改时间（毫秒） */
  mtimeMs: number
}

export interface RecalledMemory extends MemoryEntry {
  score: number
  /** 正文（已按行数/字节数截断） */
  body: string
  /** 距今天数 */
  ageDays: number
}

export interface RecallOptions {
  /** 记忆根目录；缺省由 resolveMemoryDir() 推导 */
  memoryDir?: string
  /** 单轮最多召回几条 */
  limit?: number
  /** 会话累计字节预算 */
  sessionBudgetBytes?: number
}

// ─────────────────────────────── 路径解析 ───────────────────────────────

/**
 * 把项目根路径编码成目录名。
 * 与 Claude Code 的 sanitizePath 同规则：非 [a-zA-Z0-9] 一律替换为 '-'。
 * 例：D:\KX2API → D--KX2API
 */
export function sanitizeProjectPath(projectRoot: string): string {
  const sanitized = projectRoot.replace(/[^a-zA-Z0-9]/g, '-')
  if (sanitized.length <= 200) return sanitized
  // 超长路径截断后追加 djb2 哈希后缀，避免不同项目撞目录
  let hash = 5381
  for (let i = 0; i < projectRoot.length; i++) {
    hash = ((hash << 5) + hash + projectRoot.charCodeAt(i)) >>> 0
  }
  return `${sanitized.slice(0, 200)}-${hash.toString(36)}`
}

/**
 * 推导记忆目录。
 * 优先级：KX2_MEMORY_DIR 环境变量 → <homedir>/.doge/projects/<编码后的项目根>/memory
 */
export function resolveMemoryDir(projectRoot: string = process.cwd()): string {
  const override = process.env.KX2_MEMORY_DIR
  if (override && override.trim()) return path.resolve(override.trim())
  return path.join(homedir(), '.doge', 'projects', sanitizeProjectPath(projectRoot), 'memory')
}

// ─────────────────────────────── 扫描 ───────────────────────────────

/**
 * 解析 YAML frontmatter。
 * 只支持本系统实际使用的标量字段，不引入 YAML 依赖。
 */
export function parseFrontmatter(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!text.startsWith('---')) return out
  const end = text.indexOf('\n---', 3)
  if (end < 0) return out
  const block = text.slice(3, end)
  for (const line of block.split('\n')) {
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    if (key) out[key] = value
  }
  return out
}

/** 只读文件前 n 行 —— 扫描阶段用它避免把整本记忆读进内存 */
async function readHead(absPath: string, lines: number): Promise<string> {
  const fh = await fs.open(absPath, 'r')
  try {
    const buf = Buffer.alloc(8192)
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0)
    return buf.subarray(0, bytesRead).toString('utf8').split('\n').slice(0, lines).join('\n')
  } finally {
    await fh.close()
  }
}

/**
 * 扫描记忆目录，返回所有可召回的记忆条目（不含正文）。
 * 单遍 readdir + 每文件一次读数，按 mtime 降序截断到 MAX_SCAN_FILES。
 */
export async function scanMemories(memoryDir: string): Promise<MemoryEntry[]> {
  let names: string[]
  try {
    names = await fs.readdir(memoryDir)
  } catch {
    // 目录不存在 = 还没有任何记忆，属正常状态
    return []
  }

  const entries: MemoryEntry[] = []
  for (const file of names) {
    if (!file.endsWith('.md')) continue
    // MEMORY.md 是索引本身，不作为可召回内容
    if (file === 'MEMORY.md') continue
    const absPath = path.join(memoryDir, file)
    try {
      const stat = await fs.stat(absPath)
      if (!stat.isFile()) continue
      const head = await readHead(absPath, FRONTMATTER_SCAN_LINES)
      const fm = parseFrontmatter(head)
      entries.push({
        file,
        absPath,
        name: fm.name || file.replace(/\.md$/, ''),
        description: fm.description || '',
        type: normalizeMemoryType(fm.type),
        mtimeMs: stat.mtimeMs,
      })
    } catch {
      // 单个文件读失败不应影响整体召回
      continue
    }
  }

  entries.sort((a, b) => b.mtimeMs - a.mtimeMs)
  return entries.slice(0, MAX_SCAN_FILES)
}

function normalizeMemoryType(raw: string | undefined): MemoryType | undefined {
  if (raw === 'user' || raw === 'feedback' || raw === 'project' || raw === 'reference') return raw
  return undefined
}

// ─────────────────────────────── 相关性打分 ───────────────────────────────

/**
 * 分词：拉丁/数字按词切，中文切**二元组**（bigram）。
 *
 * 中文刻意不用单字：单个汉字（"理""子""用"）几乎出现在任何中文描述里，
 * 会让「量子物理问题」这类完全无关的查询也命中一堆记忆（噪声召回）。
 * 二元组要求相邻两字都相同，判别力显著更高。
 */
function tokenize(text: string): string[] {
  const lowered = text.toLowerCase()
  const tokens: string[] = []
  for (const m of lowered.matchAll(/[a-z0-9_]+/g)) {
    tokens.push(m[0])
  }
  for (const m of lowered.matchAll(/[\u4e00-\u9fa5]+/g)) {
    const run = m[0]
    if (run.length === 1) {
      tokens.push(run)
      continue
    }
    for (let i = 0; i + 2 <= run.length; i++) {
      tokens.push(run.slice(i, i + 2))
    }
  }
  return tokens
}

const STOP_WORDS = new Set([
  // 英文虚词
  'the', 'a', 'an', 'is', 'are', 'to', 'of', 'and', 'or', 'in', 'on', 'for', 'it',
  'this', 'that', 'with', 'as', 'be', 'by', 'at', 'from',
  // 中文高频虚词二元组：在查询与记忆里都出现，无区分度
  '什么', '怎么', '如何', '可以', '需要', '如果', '因为', '所以', '这个', '那个',
  '问题', '情况', '时候', '一下', '我们', '你们', '是否', '还是', '就是',
])

/**
 * 关键词预排序。
 * 打分规则（吸收自 findRelevantMemories 的 scoreByAutoSkill）：
 * - 查询串整体包含某个名称 → +2（强信号）
 * - 词元重叠 → +1/个
 * - type=feedback/project 略加权（这类记忆对行为约束价值更高）
 */
export function scoreMemory(entry: MemoryEntry, query: string): number {
  if (!query.trim()) return 0
  const loweredQuery = query.toLowerCase()
  const queryTokens = new Set(tokenize(query).filter(t => !STOP_WORDS.has(t)))
  const haystack = `${entry.name} ${entry.description} ${entry.file}`.toLowerCase()

  let score = 0

  if (entry.name && loweredQuery.includes(entry.name.toLowerCase())) {
    score += 2
  }

  for (const token of tokenize(haystack)) {
    if (STOP_WORDS.has(token)) continue
    if (queryTokens.has(token)) score += 1
  }

  if (score > 0 && (entry.type === 'feedback' || entry.type === 'project')) {
    score += 0.5
  }

  return score
}

// ─────────────────────────────── 正文读取 ───────────────────────────────

/** 按行数与字节数双重截断（字节截断在 UTF-8 边界安全的最后一个换行处切开） */
function truncateBody(raw: string, maxLines: number, maxBytes: number): string {
  let text = raw.split('\n').slice(0, maxLines).join('\n')
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return text
  let cut = maxBytes
  // 回退到不切断多字节字符的位置
  while (cut > 0 && (text.charCodeAt(cut) & 0xc0) === 0x80) cut--
  const sliced = Buffer.from(text, 'utf8').subarray(0, cut).toString('utf8')
  const lastNewline = sliced.lastIndexOf('\n')
  text = lastNewline > 0 ? sliced.slice(0, lastNewline) : sliced
  return `${text}\n\n[... 因长度限制已截断 ...]`
}

/** 距今天数，用于「记忆可能已过时」提示 */
export function memoryAgeDays(mtimeMs: number, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - mtimeMs) / 86_400_000))
}

function ageLabel(days: number): string {
  if (days <= 0) return '今天'
  if (days === 1) return '昨天'
  return `${days} 天前`
}

// ─────────────────────────────── 对外主入口 ───────────────────────────────

/**
 * 按查询召回相关记忆。
 *
 * @param query 当前用户输入（或任意检索意图文本）
 * @param opts  目录/数量/预算覆盖
 * @returns 相关记忆列表，已按分数降序、正文已截断
 */
export async function recallMemories(
  query: string,
  opts: RecallOptions = {},
): Promise<RecalledMemory[]> {
  const memoryDir = opts.memoryDir ?? resolveMemoryDir()
  const limit = opts.limit ?? MAX_MEMORIES_PER_TURN

  const entries = await scanMemories(memoryDir)
  if (entries.length === 0) return []

  const scored = entries
    .map(entry => ({ entry, score: scoreMemory(entry, query) }))
    .filter(x => x.score >= MIN_RELEVANCE_SCORE)
    .sort((a, b) => b.score - a.score || b.entry.mtimeMs - a.entry.mtimeMs)
    .slice(0, limit)

  const out: RecalledMemory[] = []
  let budget = opts.sessionBudgetBytes ?? Number.POSITIVE_INFINITY

  for (const { entry, score } of scored) {
    if (budget <= 0) break
    try {
      const raw = await fs.readFile(entry.absPath, 'utf8')
      const allowBytes = Math.min(MAX_BYTES_PER_MEMORY, budget)
      const body = truncateBody(raw, MAX_LINES_PER_MEMORY, allowBytes)
      budget -= Buffer.byteLength(body, 'utf8')
      out.push({
        ...entry,
        score,
        body,
        ageDays: memoryAgeDays(entry.mtimeMs),
      })
    } catch {
      continue
    }
  }

  return out
}

/**
 * 把召回结果渲染成注入 system prompt 的文本块。
 * 返回 null 表示无可注入内容（调用方据此跳过，避免塞入空标题）。
 */
export function formatMemoriesForPrompt(memories: RecalledMemory[]): string | null {
  if (memories.length === 0) return null

  const blocks = memories.map(m => {
    const header = m.ageDays > 1
      ? `### ${m.name}（${ageLabel(m.ageDays)}保存 · 内容为时间点快照，其中的文件路径与行号可能已过时）`
      : `### ${m.name}（${ageLabel(m.ageDays)}保存）`
    const meta = m.description ? `${m.description}\n` : ''
    return `${header}\n${meta}\n${m.body.trim()}`
  })

  return [
    '<memory>',
    '以下是此前沉淀的记忆，供你参考。记忆记录的是**写入当时**的事实，',
    '在据此下结论或推荐之前，请先核对当前代码/文件的真实状态。',
    '',
    blocks.join('\n\n'),
    '</memory>',
  ].join('\n')
}

/**
 * 一步到位：召回 + 渲染。无相关记忆时返回 null。
 * 这是接入方唯一需要调用的函数。
 */
export async function buildMemoryPromptSection(
  query: string,
  opts: RecallOptions = {},
): Promise<string | null> {
  try {
    const memories = await recallMemories(query, opts)
    return formatMemoriesForPrompt(memories)
  } catch {
    // 记忆是增强项；任何异常都不应阻断主请求
    return null
  }
}
