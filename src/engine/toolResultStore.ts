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

/** 结果落盘前的最大字符数（超过则持久化到磁盘） */
export const DEFAULT_MAX_RESULT_SIZE_CHARS = 50_000

/** 预览取多少字节给模型看 */
export const PREVIEW_SIZE_BYTES = 2000

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

  const { preview, hasMore } = generatePreview(contentStr, PREVIEW_SIZE_BYTES)
  return { filepath, originalSize: contentStr.length, isJson, preview, hasMore }
}

/**
 * 构造模型看到的消息（预览 + 完整内容的路径）。
 * 模型需要全文时用 Read 工具读该路径。
 */
export function buildLargeToolResultMessage(result: PersistedToolResult): string {
  let message = `${PERSISTED_OUTPUT_TAG}\n`
  message += `输出过大（${formatSize(result.originalSize)}），完整内容已保存到：${result.filepath}\n\n`
  message += `预览（前 ${formatSize(PREVIEW_SIZE_BYTES)}）：\n`
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
  maxChars: number = DEFAULT_MAX_RESULT_SIZE_CHARS,
): Promise<string> {
  if (typeof content !== 'string') return String(content ?? '')
  if (content.length <= maxChars) return content
  try {
    const r = await persistToolResult(content, toolUseId)
    if (isPersistError(r)) return content
    return buildLargeToolResultMessage(r)
  } catch {
    return content
  }
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
