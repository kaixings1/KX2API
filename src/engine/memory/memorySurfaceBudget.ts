/**
 * engine/memory/memorySurfaceBudget.ts — 记忆注入的会话预算与去重
 *
 * 移植自 D:\src\utils\attachments.ts 的 `collectSurfacedMemories` /
 * `filterDuplicateMemoryAttachments` / `RELEVANT_MEMORIES_CONFIG`。
 *
 * ─────────────────────────────────────────────────────────────
 * 解决什么问题
 * ─────────────────────────────────────────────────────────────
 * `memoryRecall` 只做了**单文件**预算（200 行 / 4096 字节）。
 * 但一次会话里记忆会被反复注入（每轮请求都跑一次召回），
 * 于是单文件预算根本拦不住总量：5 条 × 4KB × N 轮 = 无上限。
 *
 * 上游的口径是再加一道**会话级累计预算**（60KB），并配一套去重，
 * 让同一条记忆在同一会话里只注入一次。
 *
 * ─────────────────────────────────────────────────────────────
 * 关键设计：扫描消息，而不是维护计数器
 * ─────────────────────────────────────────────────────────────
 * 上游源码注释把理由写得很明白（这是本模块最值得移植的一点）：
 *
 * > 扫描消息而非在 toolUseContext 里维护计数器，这样 /compact 之后
 * > 旧附件从上下文消失，预算与去重会自然重置，重新浮现是合法的。
 *
 * 这个性质很重要：压缩之后模型的上下文里已经没有那些记忆了，
 * 此时「再注入一次」是**正确行为**。若改用持久计数器，压缩后会永远
 * 不再注入任何记忆 —— 用户会觉得"记忆功能莫名其妙失效了"。
 */

import type { RecalledMemory } from './memoryRecall.ts'

/** 会话内累计注入的记忆字节上限（对齐上游 60 * 1024） */
export const MAX_SESSION_MEMORY_BYTES = 60 * 1024

/** 单轮最多注入几条 */
export const MAX_MEMORIES_PER_TURN = 5

export interface SurfacedMemories {
  /** 已经注入过的记忆文件名集合 */
  files: Set<string>
  /** 已注入内容的总字节数 */
  totalBytes: number
}

/** 注入块的分隔标记（从消息文本里定位注入内容用） */
const MEMORY_BLOCK_RE = /<memory>([\s\S]*?)<\/memory>/gi

/** 从注入块里提取记忆文件名：标题形如 `### 名称 · 文件名.md（...）` */
const MEMORY_FILE_LINE_RE = /^###\s+(.+?)\s*·\s*([^\s·（）()]+\.md)/gm

/**
 * 扫描对话历史，统计已经注入过的记忆。
 *
 * 返回 files（供去重）与 totalBytes（供预算）。
 * 只扫描**可见于当前上下文**的消息 —— 调用方应传入当前的消息列表，
 * 压缩后旧消息自然不在其中，于是预算与去重自动重置。
 */
export function collectSurfacedMemories(
  messages: ReadonlyArray<{ content?: unknown; role?: string }>,
): SurfacedMemories {
  const files = new Set<string>()
  let totalBytes = 0

  for (const msg of messages) {
    const text = extractText(msg?.content)
    if (!text || !text.includes('<memory>')) continue

    MEMORY_BLOCK_RE.lastIndex = 0
    let block: RegExpExecArray | null
    while ((block = MEMORY_BLOCK_RE.exec(text)) !== null) {
      const inner = block[1] ?? ''
      totalBytes += Buffer.byteLength(inner, 'utf8')

      MEMORY_FILE_LINE_RE.lastIndex = 0
      let line: RegExpExecArray | null
      while ((line = MEMORY_FILE_LINE_RE.exec(inner)) !== null) {
        const file = line[2]?.trim()
        if (file) files.add(file)
      }
    }
  }

  return { files, totalBytes }
}

/** 从消息内容里抽文本（兼容字符串与内容块数组） */
function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    const parts: string[] = []
    for (const block of content) {
      if (block && typeof block === 'object') {
        const b = block as Record<string, unknown>
        if (typeof b.text === 'string') parts.push(b.text)
      }
    }
    return parts.join('\n')
  }
  return ''
}

/**
 * 过滤掉已经注入过的记忆。
 *
 * 同时按「剩余预算」截断 —— 二者必须一起做：
 * 只去重不管预算，仍可能一轮塞进过多内容；
 * 只算预算不去重，同一条记忆会反复占用额度。
 */
export function filterAlreadySurfaced(
  candidates: readonly RecalledMemory[],
  surfaced: SurfacedMemories,
  maxBytes: number = MAX_SESSION_MEMORY_BYTES,
): RecalledMemory[] {
  const remaining = maxBytes - surfaced.totalBytes
  if (remaining <= 0) return []

  const out: RecalledMemory[] = []
  let used = 0

  for (const m of candidates) {
    if (surfaced.files.has(m.file)) continue

    const size = Buffer.byteLength(m.body, 'utf8')
    if (used + size > remaining) continue // 放不下就跳过该条，继续看后面更小的
    used += size
    out.push(m)

    if (out.length >= MAX_MEMORIES_PER_TURN) break
  }

  return out
}

/** 会话剩余的记忆注入额度（字节） */
export function computeRemainingBudget(
  surfaced: SurfacedMemories,
  maxBytes: number = MAX_SESSION_MEMORY_BYTES,
): number {
  return Math.max(0, maxBytes - surfaced.totalBytes)
}

/**
 * 一步到位：给定候选记忆与当前消息列表，算出本轮该注入哪些。
 *
 * 这是接入方唯一需要调用的函数 —— 它把「扫历史 → 去重 → 按剩余额度截断」
 * 串成一个动作，避免调用方漏掉其中任一步。
 */
export interface SurfaceSelection {
  /** 本轮应注入的记忆 */
  selected: RecalledMemory[]
  /** 历史里已注入的记忆（供诊断） */
  surfaced: SurfacedMemories
  /** 本轮选中的内容占用的字节数 */
  selectedBytes: number
  /**
   * **注入本轮之后**的剩余额度。
   *
   * 刻意定义为"扣除本轮选中量之后"的值 —— 调用方拿它做后续判断
   * （例如"剩余额度还够不够再注入工具文档"）时，若不含本轮用量就会高估。
   */
  remainingBytes: number
}

export function selectMemoriesToSurface(
  candidates: readonly RecalledMemory[],
  messages: ReadonlyArray<{ content?: unknown; role?: string }>,
  maxBytes: number = MAX_SESSION_MEMORY_BYTES,
): SurfaceSelection {
  const surfaced = collectSurfacedMemories(messages)
  const selected = filterAlreadySurfaced(candidates, surfaced, maxBytes)
  const selectedBytes = selected.reduce((n, m) => n + Buffer.byteLength(m.body, 'utf8'), 0)
  return {
    selected,
    surfaced,
    selectedBytes,
    remainingBytes: Math.max(0, computeRemainingBudget(surfaced, maxBytes) - selectedBytes),
  }
}
