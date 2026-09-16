/**
 * engine/toolResultStore.ts — 工具结果落盘
 *
 * 移植自 D:\src\utils\toolResultStorage.ts + D:\src\constants\toolLimits.ts。
 *
 * 解决的问题：单个工具输出动辄几十万字符（读日志、跑构建、列大目录），
 * 整段塞进上下文会瞬间吃光窗口，而截断又会让模型拿不到关键信息。
 * 做法是把超限结果写到磁盘，只在上下文里留一个带路径的预览 —— 模型
 * 需要完整内容时用 Read 工具按路径读取即可。
 *
 * 口径（对齐上游常量）：
 * - 单结果超过 50_000 字符 → 落盘
 * - 预览取前 2000 字节，并在最近的换行处切开（不切断行）
 * - 落盘用 'wx' 幂等：同一 toolUseId 只写一次，避免每轮重写
 */

import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { groupMessagesByApiRound } from './messageIntegrity.ts'
import type { InternalMessage } from './messageNormalizer.ts'

/** 结果落盘前的最大字符数（超过则持久化到磁盘） */
export const DEFAULT_MAX_RESULT_SIZE_CHARS = 50_000

/** 预览取多少字节给模型看 */
export const DEFAULT_PREVIEW_SIZE_BYTES = 2000

/** 兼容旧引用：预览大小的默认值 */
export const PREVIEW_SIZE_BYTES = DEFAULT_PREVIEW_SIZE_BYTES

/**
 * 工具结果落盘策略（此前为硬编码常量，现可配置）。
 *
 * 这两个值直接决定「工具输出是否被落盘、模型能看到多少预览」：
 * 阈值调小则更早落盘、上下文更省，但模型需多一次 Read 才能拿到全文；
 * 阈值调大则更少落盘、交互更直接，但大输出会更快吃光上下文窗口。
 */
export interface ToolResultStoreOptions {
  /** 超过多少字符触发落盘；默认 50000 */
  maxResultSizeChars?: number
  /** 预览字节数；默认 2000 */
  previewSizeBytes?: number
  /** 单条 API 消息内 tool_result 聚合上限；默认 200000 */
  maxResultsPerMessageChars?: number
}

/** 单条 API 消息内 tool_result 的默认聚合上限 */
export const DEFAULT_MAX_RESULTS_PER_MESSAGE_CHARS = 200_000

const toolResultStoreOptions: Required<ToolResultStoreOptions> = {
  maxResultSizeChars: DEFAULT_MAX_RESULT_SIZE_CHARS,
  previewSizeBytes: DEFAULT_PREVIEW_SIZE_BYTES,
  maxResultsPerMessageChars: DEFAULT_MAX_RESULTS_PER_MESSAGE_CHARS,
}

/** 读取当前生效的落盘策略 */
export function getToolResultStoreOptions(): Required<ToolResultStoreOptions> {
  return { ...toolResultStoreOptions }
}

/** 更新落盘策略（设置界面改完即时生效）；非法值忽略 */
export function setToolResultStoreOptions(opts: ToolResultStoreOptions): void {
  const {
    maxResultSizeChars: m,
    previewSizeBytes: p,
    maxResultsPerMessageChars: a,
  } = opts
  if (typeof m === 'number' && Number.isFinite(m) && m > 0) {
    toolResultStoreOptions.maxResultSizeChars = Math.floor(m)
  }
  if (typeof p === 'number' && Number.isFinite(p) && p > 0) {
    toolResultStoreOptions.previewSizeBytes = Math.floor(p)
  }
  if (typeof a === 'number' && Number.isFinite(a) && a > 0) {
    toolResultStoreOptions.maxResultsPerMessageChars = Math.floor(a)
  }
}

export const PERSISTED_OUTPUT_TAG = '<persisted-output>'
export const PERSISTED_OUTPUT_CLOSING_TAG = '</persisted-output>'

const TOOL_RESULTS_SUBDIR = 'tool-results'

let baseDir: string | null = null

/**
 * 配置落盘根目录（主进程启动时调用，传 app.getPath('userData')）。
 * 未配置时回落到系统临时目录，保证纯 Node 环境与测试也能工作。
 */
export function setToolResultsBaseDir(dir: string | null): void {
  baseDir = dir
}

function resolveBaseDir(): string {
  if (baseDir) return baseDir
  const fromEnv = process.env.KX2_TOOL_RESULTS_DIR
  if (fromEnv && fromEnv.trim()) return fromEnv.trim()
  return path.join(os.tmpdir(), 'kx2code')
}

/** 工具结果落盘目录 */
export function getToolResultsDir(): string {
  return path.join(resolveBaseDir(), TOOL_RESULTS_SUBDIR)
}

/** 单个结果的文件路径。非文本（数组）结果存 .json */
export function getToolResultPath(toolUseId: string, isJson: boolean): string {
  // 防路径穿越：toolUseId 来自模型，可能含 / 或 ..，
  // 只保留安全字符，其余替换为下划线。
  const safe = toolUseId.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 200)
  return path.join(getToolResultsDir(), `${safe}${isJson ? '.json' : '.txt'}`)
}

export interface PersistedToolResult {
  filepath: string
  originalSize: number
  isJson: boolean
  preview: string
  hasMore: boolean
}

export interface PersistToolResultError {
  error: string
}

export function isPersistError(
  r: PersistedToolResult | PersistToolResultError,
): r is PersistToolResultError {
  return 'error' in r
}

/**
 * 生成预览：在限制内取最后一段完整行。
 * 若最近换行离上限太远（不足一半），直接按上限硬切，避免预览过短。
 */
export function generatePreview(content: string, maxBytes: number): { preview: string; hasMore: boolean } {
  if (content.length <= maxBytes) {
    return { preview: content, hasMore: false }
  }
  const truncated = content.slice(0, maxBytes)
  const lastNewline = truncated.lastIndexOf('\n')
  const cutPoint = lastNewline > maxBytes * 0.5 ? lastNewline : maxBytes
  return { preview: content.slice(0, cutPoint), hasMore: true }
}

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * 把超限的工具结果落盘。
 *
 * @param content   工具输出。字符串按文本存；内容块数组按 JSON 存
 *                  （但含非 text 块时拒绝落盘 —— 图片等二进制无法序列化）
 * @param toolUseId 工具调用 id，作为文件名
 */
export async function persistToolResult(
  content: string | Array<Record<string, unknown>>,
  toolUseId: string,
): Promise<PersistedToolResult | PersistToolResultError> {
  const isJson = Array.isArray(content)

  if (isJson) {
    const hasNonText = content.some(b => b && typeof b === 'object' && b.type !== 'text')
    if (hasNonText) {
      return { error: '无法落盘：包含非文本内容（如图片）的工具结果' }
    }
  }

  const dir = getToolResultsDir()
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch (e) {
    return { error: `创建落盘目录失败: ${(e as Error).message}` }
  }

  const filepath = getToolResultPath(toolUseId, isJson)
  const contentStr = isJson ? JSON.stringify(content, null, 2) : (content as string)

  try {
    // 'wx' = 独占创建。toolUseId 唯一且内容确定，已存在说明此前轮次已写过，
    // 直接跳过即可 —— 用 wx 而非 stat-then-write 可避免竞态。
    await fs.writeFile(filepath, contentStr, { encoding: 'utf-8', flag: 'wx' })
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code !== 'EEXIST') {
      return { error: `写入落盘文件失败: ${(e as Error).message}` }
    }
    // EEXIST：此前已落盘，继续走预览分支
  }

  const { preview, hasMore } = generatePreview(
    contentStr,
    toolResultStoreOptions.previewSizeBytes,
  )
  return { filepath, originalSize: contentStr.length, isJson, preview, hasMore }
}

/**
 * 构造模型看到的消息（预览 + 完整内容的路径）。
 * 模型需要全文时用 Read 工具读该路径。
 */
export function buildLargeToolResultMessage(result: PersistedToolResult): string {
  let message = `${PERSISTED_OUTPUT_TAG}\n`
  message += `输出过大（${formatSize(result.originalSize)}），完整内容已保存到：${result.filepath}\n\n`
  message += `预览（前 ${formatSize(toolResultStoreOptions.previewSizeBytes)}）：\n`
  message += result.preview
  message += result.hasMore ? '\n...\n' : '\n'
  message += PERSISTED_OUTPUT_CLOSING_TAG
  return message
}

/**
 * 一步到位：结果超限则落盘并返回预览文本，否则原样返回。
 *
 * 这是接入方唯一需要调用的函数 —— 在工具执行完成后包一层即可。
 * 任何异常都降级为「返回原内容」，落盘属增强项，绝不能因为它失败而丢掉工具输出。
 */
export async function maybePersistToolResult(
  content: string,
  toolUseId: string,
  maxChars?: number,
): Promise<string> {
  if (typeof content !== 'string') return String(content ?? '')
  const limit = maxChars ?? toolResultStoreOptions.maxResultSizeChars
  if (content.length <= limit) return content
  try {
    const r = await persistToolResult(content, toolUseId)
    if (isPersistError(r)) return content
    return buildLargeToolResultMessage(r)
  } catch {
    return content
  }
}

// ==================== 单消息聚合预算 ====================
//
// 单个结果有 50K 阈值，但 **N 个并行工具各 40K 就能凑出 400K** —— 单结果阈值
// 拦不住这种聚合。此处按「一轮（一条 API user 消息）」再设一道闸。
// 默认值 DEFAULT_MAX_RESULTS_PER_MESSAGE_CHARS 定义在文件前部的配置区。

interface ContentReplacementRecord {
  toolUseId: string
  /** 替换后的文本（冻结保存，重放时保证字节一致） */
  replacement: string
  originalSize: number
}

/**
 * 替换决策状态。
 *
 * **冻结语义是这个设计的核心**：一旦某个 toolUseId 被决策过（替换或不替换），
 * 后续轮次不得反悔。原因是每次改变替换集合都会改变请求前缀，
 * 使 prompt cache 全量失效 —— 宁可接受超支，也不要在轮次之间反复横跳。
 */
export interface ContentReplacementState {
  /** toolUseId → 替换记录；null 表示"已决策为不替换"（同样冻结） */
  decisions: Map<string, ContentReplacementRecord | null>
}

export function createContentReplacementState(): ContentReplacementState {
  return { decisions: new Map() }
}

/** 取消息的文本形态（tool 消息的 content 可能是字符串或块数组） */
function textOf(msg: { content: unknown }): string {
  const c = msg.content
  if (typeof c === 'string') return c
  if (c == null) return ''
  try {
    return JSON.stringify(c)
  } catch {
    return ''
  }
}

/**
 * 对超预算的一轮 tool_result 做聚合裁剪。
 *
 * 处理顺序：按结果大小**降序**替换（先替换最大的，用最少的次数把总量压到预算内）。
 * 只替换「尚未决策」的结果；已决策的一律遵守既有决定。
 *
 * @param messages  完整消息列表（不修改入参）
 * @param state     跨轮次持久化的决策状态（同一会话内复用同一个实例）
 * @param budgetChars 单轮聚合上限
 */
export async function enforceToolResultBudget(
  messages: InternalMessage[],
  state: ContentReplacementState,
  budgetChars?: number,
): Promise<InternalMessage[]> {
  const budgetLimit = budgetChars ?? toolResultStoreOptions.maxResultsPerMessageChars
  const rounds = groupMessagesByApiRound(messages)
  const out: InternalMessage[] = []

  for (const round of rounds) {
    const toolMsgs = round.filter(m => m.role === 'tool')
    if (toolMsgs.length === 0) {
      out.push(...round)
      continue
    }

    const sizeOf = (m: { content: unknown }) => textOf(m).length
    let total = toolMsgs.reduce((n, m) => n + sizeOf(m), 0)

    if (total <= budgetLimit) {
      // 本轮没超预算：把未决策的结果冻结为"永不替换"，
      // 避免后续轮次因上下文增长而突然开始替换、破坏缓存前缀。
      for (const m of toolMsgs) {
        if (m.toolUseId && !state.decisions.has(m.toolUseId)) {
          state.decisions.set(m.toolUseId, null)
        }
      }
      out.push(...round)
      continue
    }

    const replacements = new Map<string, string>()
    const order = [...toolMsgs].sort((a, b) => sizeOf(b) - sizeOf(a))

    for (const m of order) {
      if (total <= budgetLimit) break
      const id = m.toolUseId
      if (!id) continue

      const decided = state.decisions.get(id)
      if (decided) {
        // 已决策替换：重放冻结的字符串（零 I/O，字节一致，必然命中缓存）
        replacements.set(id, decided.replacement)
        total -= sizeOf(m) - decided.replacement.length
        continue
      }
      if (state.decisions.has(id)) continue // 已决策不替换 → 冻结，跳过

      // 首次决策：落盘并记录
      try {
        const r = await persistToolResult(textOf(m), id)
        if (isPersistError(r)) {
          state.decisions.set(id, null)
          continue
        }
        const replacement = buildLargeToolResultMessage(r)
        // 净减少保护：预览正文（含路径头部与截断提示）本身也有体积。
        // 预算极小时，替换一个不大的结果后可能反而更长 —— 此时替换毫无意义，跳过。
        if (replacement.length >= sizeOf(m)) {
          state.decisions.set(id, null)
          continue
        }
        state.decisions.set(id, { toolUseId: id, replacement, originalSize: sizeOf(m) })
        replacements.set(id, replacement)
        total -= sizeOf(m) - replacement.length
      } catch {
        // 落盘失败：冻结为不替换，绝不因为预算控制而丢掉工具输出
        state.decisions.set(id, null)
      }
    }

    out.push(
      ...round.map(m => {
        if (m.role !== 'tool' || !m.toolUseId) return m
        const rep = replacements.get(m.toolUseId)
        return rep == null ? m : { ...m, content: rep }
      }),
    )
  }

  return out
}

/**
 * 清理过期落盘文件（按 mtime，默认 30 天）。
 * 供主进程定时任务调用；返回删除的文件数。
 */
export async function cleanupToolResults(olderThanDays = 30): Promise<number> {
  const dir = getToolResultsDir()
  const cutoff = Date.now() - olderThanDays * 86_400_000
  let removed = 0
  let names: string[]
  try {
    names = await fs.readdir(dir)
  } catch {
    return 0
  }
  for (const name of names) {
    const p = path.join(dir, name)
    try {
      const st = await fs.stat(p)
      if (st.isFile() && st.mtimeMs < cutoff) {
        await fs.unlink(p)
        removed++
      }
    } catch {
      continue
    }
  }
  return removed
}
