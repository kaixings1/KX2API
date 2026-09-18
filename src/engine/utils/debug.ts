/**
 * utils/debug.ts — 调试日志工具（简化版）
 *
 * 吸收自 D:\src\utils\debug.ts 的核心功能。
 * 提供 logForDebugging 供引擎模块使用。
 */

import { mkdir, appendFile } from 'fs/promises'
import { join, dirname } from 'path'

/**
 * 进程级会话标识，用于隔离每次运行的调试日志文件。
 *
 * 原先取自 `bootstrap/state` 的 getSessionId()，但该模块在移植时并未落地
 *（bootstrap 下只有 index/macro/setup）。同项目 transcript.ts 已给出处置方向：
 * 不依赖外部会话管理，由需要方自行持有标识。故此处本地生成。
 */
const PROCESS_SESSION_ID = `${Date.now().toString(36)}-${process.pid}`

/** 取本次进程的调试会话标识 */
function getSessionId(): string {
  return PROCESS_SESSION_ID
}

export type DebugLogLevel = 'verbose' | 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<DebugLogLevel, number> = {
  verbose: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
}

/** 最小日志级别 */
export function getMinDebugLogLevel(): DebugLogLevel {
  const raw = process.env.CLAUDE_CODE_DEBUG_LOG_LEVEL?.toLowerCase().trim()
  if (raw && Object.hasOwn(LEVEL_ORDER, raw)) {
    return raw as DebugLogLevel
  }
  return 'debug'
}

/** 是否处于调试模式 */
export function isDebugMode(): boolean {
  return (
    process.env.DEBUG === '1' ||
    process.env.DEBUG_SDK === '1' ||
    process.argv.includes('--debug') ||
    process.argv.includes('-d')
  )
}

/** 获取调试日志文件路径 */
export function getDebugLogPath(): string {
  const envDir = process.env.CLAUDE_CODE_DEBUG_LOGS_DIR
  if (envDir) {
    return join(envDir, 'debug.txt')
  }
  return join(process.cwd(), 'debug', 'debug.txt')
}

let pendingWrite: Promise<void> = Promise.resolve()

/**
 * 写入调试日志（异步，不阻塞调用方）。
 * 未开启调试模式时静默跳过。
 */
export function logForDebugging(
  message: string,
  { level }: { level?: DebugLogLevel } = { level: 'debug' },
): void {
  if (LEVEL_ORDER[level ?? 'debug'] < LEVEL_ORDER[getMinDebugLogLevel()]) {
    return
  }
  if (!isDebugMode()) {
    return
  }

  const now = new Date()
  const timestamp = now.toLocaleString('sv-SE').replace('T', ' ').slice(0, 19)
  const output = `${timestamp} [${(level ?? 'debug').toUpperCase()}] ${message.trim()}\n`

  pendingWrite = pendingWrite
    .then(async () => {
      try {
        const dir = dirname(getDebugLogPath())
        await mkdir(dir, { recursive: true }).catch(() => {})
        await appendFile(getDebugLogPath(), output)
      } catch {
        // 静默失败，调试日志不影响主流程
      }
    })
    .catch(() => {})
}
