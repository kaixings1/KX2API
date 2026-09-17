/**
 * engine/sessionRecovery.ts — 会话恢复（崩溃/重启后对话不丢）
 *
 * 参考 D:\src\utils\conversationRecovery.ts / sessionRestore.ts 的「持久化 + 重建」思想，
 * 但用当前项目自己的存储底座实现 —— 上游那两个文件 597/653 行且重度耦合
 * （worktree / plans / attribution / fileHistory / attachments 等，Electron 环境不适用），
 * 直接搬代价高且大部分依赖在本项目不存在。
 *
 * 本模块是对当前项目"会话历史纯内存、重启即丢"缺口的轻量闭合：
 * - 每次对话（一轮 query 结束）把最新消息快照原子落盘
 * - 页面拉取历史（getHistory）时若内存为空、快照存在则水合
 * - 用户 clearHistory 时删除快照（语义：用户重新开始 = 丢弃上次会话）
 *
 * 目录与记忆系统同构：`<home>/.doge/projects/<sanitize(项目根)>/session.json`。
 *
 * 设计要点：
 * - **原子写**（tmp + rename），避免崩溃时读到半截快照
 * - **零依赖**：仅 node:fs/path/os，main/renderer 之外的 engine 可直接用
 * - **失败静默**：读/写/删快照的任何异常都不应阻断主请求
 */
import { promises as fs, readFileSync } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

/** 会话快照文件名 */
export const SESSION_SNAPSHOT_FILE = 'session.json'

/**
 * 项目根编码为目录名（与记忆系统 sanitize 同规则），保证不同项目不串会话。
 */
export function sanitizeForSession(projectRoot: string): string {
  const sanitized = projectRoot.replace(/[^a-zA-Z0-9]/g, '-')
  if (sanitized.length <= 200) return sanitized
  let hash = 5381
  for (let i = 0; i < projectRoot.length; i++) {
    hash = ((hash << 5) + hash + projectRoot.charCodeAt(i)) >>> 0
  }
  return `${sanitized.slice(0, 200)}-${hash.toString(36)}`
}

/** 会话快照目录：缺省从项目根推导 */
export function resolveSessionSnapshotDir(projectRoot: string = process.cwd()): string {
  const override = process.env.KX2_SESSION_DIR
  if (override && override.trim()) return path.resolve(override.trim())
  return path.join(os.homedir(), '.doge', 'projects', sanitizeForSession(projectRoot))
}

function snapshotPath(dir: string): string {
  return path.join(dir, SESSION_SNAPSHOT_FILE)
}

export interface SessionMessageSnapshot {
  role: string
  content: unknown
}

export interface SessionSnapshot {
  /** 落盘时间（ISO） */
  savedAt: string
  messages: SessionMessageSnapshot[]
  extra?: Record<string, unknown>
}

/**
 * 保存会话快照（原子覆盖写）。
 * 空消息数组也允许 —— 表示「会话已清空」，恢复时照此处理。
 */
export async function saveSessionSnapshot(
  messages: SessionMessageSnapshot[],
  opts: { dir?: string; extra?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    const dir = opts.dir ?? resolveSessionSnapshotDir()
    await fs.mkdir(dir, { recursive: true })
    const snapshot: SessionSnapshot = {
      savedAt: new Date().toISOString(),
      messages,
      ...(opts.extra ? { extra: opts.extra } : {}),
    }
    const filePath = snapshotPath(dir)
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`
    await fs.writeFile(tmp, JSON.stringify(snapshot), 'utf-8')
    try {
      await fs.rename(tmp, filePath)
    } catch (e) {
      await fs.unlink(tmp).catch(() => {})
      throw e
    }
  } catch (error) {
    console.warn(`[sessionRecovery] saveSnapshot failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** 读取会话快照；不存在或损坏返回 null（不抛） */
export async function loadSessionSnapshot(
  opts: { dir?: string } = {},
): Promise<SessionSnapshot | null> {
  try {
    const file = snapshotPath(opts.dir ?? resolveSessionSnapshotDir())
    const raw = await fs.readFile(file, 'utf-8')
    const parsed = JSON.parse(raw) as SessionSnapshot
    if (!Array.isArray(parsed.messages)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * 同步读取会话快照。
 *
 * 专供 getHistory 这类「启动/入页时不想引入异步链路」的调用点：
 * 渲染层首次拉取历史希望同步拿到旧对话。读失败一律返回 null（不抛）。
 */
export function loadSessionSnapshotSync(opts: { dir?: string } = {}): SessionSnapshot | null {
  try {
    const file = snapshotPath(opts.dir ?? resolveSessionSnapshotDir())
    const raw = readFileSync(file, 'utf-8')
    const parsed = JSON.parse(raw) as SessionSnapshot
    if (!Array.isArray(parsed.messages)) return null
    return parsed
  } catch {
    return null
  }
}

/** 删除会话快照（用户清空会话时调用）。返回是否存在并删除。 */
export async function clearSessionSnapshot(opts: { dir?: string } = {}): Promise<boolean> {
  try {
    const file = snapshotPath(opts.dir ?? resolveSessionSnapshotDir())
    await fs.unlink(file)
    return true
  } catch {
    return false // 不存在或删除失败等同视为已清除
  }
}

/** 快照路径（测试用） */
export function sessionSnapshotPath(opts: { dir?: string } = {}): string {
  return snapshotPath(opts.dir ?? resolveSessionSnapshotDir())
}