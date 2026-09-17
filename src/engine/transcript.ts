/**
 * engine/transcript.ts — 会话转录（压缩前原文快照）
 *
 * 移植自 D:\src\services\sessionTranscript\sessionTranscript.ts。
 *
 * 解决的问题：上下文压缩会把压缩前的消息摘要化，压缩后若需要复盘原始对话
 * （排查一次工具调用为何异常、审计某轮交换），原始消息已不可得。
 * 本模块在**每次压缩执行前**把消息原文 JSON 落盘到
 * `<homedir>/.doge/transcripts/<sessionId>-<YYYY-MM-DD>.jsonl`，
 * 一行一条消息，供事后追溯。
 *
 * 与上游的差异：
 * - 依赖替换：`getSessionId()`（Claude Code bootstrap）→ 显式传入 `sessionId`
 *   参数（本项目未引入 bootstrap 状态；messageLoop 有能力提供会话标识）。
 *   `logForDebugging` → `console.warn`（本项目 engine 无顶层调试日志单例，避免循环依赖）。
 * - 目录口径沿用上游：`<home>/.doge/transcripts/`，与记忆系统 `<home>/.doge/` 同级同构。
 *
 * 设计要点：
 * - **fire-and-forget**：errors 一律吞掉，绝不阻断正常压缩流程。
 * - 同步 `appendFileSync`：一次压缩一条记录，短小同步写入简单可靠，不做异步队列。
 */

import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

/** 转录根目录（与项目记忆系统同构于 <home>/.doge/ 之下） */
export function resolveTranscriptDir(): string {
  return path.join(os.homedir(), '.doge', 'transcripts')
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function transcriptPath(sessionId: string, date: string, dir: string): string {
  return path.join(dir, `${sessionId}-${date}.jsonl`)
}

interface SegmentMessage {
  role?: string
  speaker?: string
  content?: unknown
}

/** 序列化单条消息为转录行（content 明文字段，方便人工阅读） */
function line(msg: SegmentMessage, sessionId: string, ts: string, flushed = false): string {
  return JSON.stringify({
    ts,
    role: msg.role ?? msg.speaker ?? 'unknown',
    sessionId,
    content: typeof msg.content === 'string' ? msg.content : msg.content,
    ...(flushed ? { flushed: true } : {}),
  })
}

export interface TranscriptOptions {
  /** 会话标识，用于区分不同会话的文件；缺省用当天时间戳 */
  sessionId?: string
  /** 转录根目录覆盖（测试用） */
  dir?: string
}

/**
 * 把一段对话（messages）追加到会话的当日转录文件。
 *
 * 供压缩前调用：把将要被压缩掉的原文留下。
 */
export function writeSessionTranscriptSegment(
  messages: SegmentMessage[],
  opts: TranscriptOptions = {},
): void {
  if (!messages || messages.length === 0) return
  try {
    const sessionId = opts.sessionId ?? 'session'
    const dir = opts.dir ?? resolveTranscriptDir()
    ensureDir(dir)
    const now = new Date()
    const date = now.toISOString().slice(0, 10)
    const filePath = transcriptPath(sessionId, date, dir)
    const ts = now.toISOString()
    const lines = messages.map(m => line(m, sessionId, ts))
    appendFileSync(filePath, lines.join('\n') + '\n', 'utf-8')
  } catch (error) {
    console.warn(`[transcript] writeSessionTranscriptSegment failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 补刷剩余消息并（若日期改变）轮转到新文件。
 *
 * 上游在压缩收尾时调用，确保「今天」的记录在跨天时干净落到今天的文件。
 *
 * @param messages    待刷剩余消息
 * @param currentDate ISO 日期（YYYY-MM-DD），落到该文件
 */
export function flushOnDateChange(
  messages: SegmentMessage[],
  currentDate: string,
  opts: TranscriptOptions = {},
): void {
  if (!messages || messages.length === 0) return
  try {
    const sessionId = opts.sessionId ?? 'session'
    const dir = opts.dir ?? resolveTranscriptDir()
    ensureDir(dir)
    const filePath = transcriptPath(sessionId, currentDate, dir)
    const ts = new Date().toISOString()
    const lines = messages.map(msg => line(msg, sessionId, ts, true))
    appendFileSync(filePath, lines.join('\n') + '\n', 'utf-8')
  } catch (error) {
    console.warn(`[transcript] flushOnDateChange failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}