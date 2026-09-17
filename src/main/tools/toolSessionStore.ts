/**
 * main/tools/toolSessionStore.ts — 工具会话状态的持久化与历史推导
 *
 * ─────────────────────────────────────────────────────────────
 * 解决什么问题
 * ─────────────────────────────────────────────────────────────
 * 原先「当前会话活跃了哪些工具」只存在进程内的 `Map<sessionId, state>` 里。
 * 这带来三个后果：
 *   1. **重启即丢** —— 用户 tool_load 进来的工具，重启应用后全部失效，
 *      而对话历史还在，模型以为工具仍可用 → 调用失败。
 *   2. **压缩/分支后与历史不一致** —— 活跃集是可变状态，对话历史是事实记录，
 *      两者会各说各话。
 *   3. **无法从历史重建** —— 想恢复只能靠用户手动再 load 一次。
 *
 * 对照 Claude Code 的做法：它的「已加载工具」是**从对话历史反扫推导**的
 * （`extractDiscoveredToolNames` 扫消息里的工具标记），因此天然可重放、
 * 抗重启、压缩后仍能恢复。
 *
 * 本模块做两件事：
 *   - `ToolSessionStore`：把活跃集 + LRU 时间戳落盘到 userData（write-behind 批量写）
 *   - `deriveActiveToolsFromMessages`：从对话历史反扫，重建活跃集
 *
 * ⚠️ 落盘用**异步 write-behind**：工具调用是热路径，不能每次 touch 都同步写盘。
 */

import { promises as fs, writeFileSync, renameSync, mkdirSync, unlinkSync } from 'node:fs'
import * as path from 'node:path'

export interface PersistedSessionState {
  /** 活跃工具 id */
  active: string[]
  /** 角色 id */
  roleId: string
  /** 工具 id → 最后使用时间戳 */
  lastUsed: Record<string, number>
  /** 最后更新时间 */
  updatedAt: number
}

export interface PersistedStoreShape {
  version: 1
  sessions: Record<string, PersistedSessionState>
}

/** 落盘防抖间隔（毫秒）—— 热路径不应每次改动都写盘 */
export const PERSIST_DEBOUNCE_MS = 2000

/** 单会话保留的 lastUsed 条目上限（防长会话无限增长） */
export const MAX_LAST_USED_ENTRIES = 500

/** 最多保留多少个会话（按 updatedAt 淘汰最旧） */
export const MAX_SESSIONS = 50

let storePath: string | null = null

/** 设置落盘路径（主进程启动时调用） */
export function setToolSessionStorePath(p: string | null): void {
  storePath = p
}

export function getToolSessionStorePath(): string | null {
  return storePath
}

/** 从磁盘读取全部会话状态；文件不存在或损坏都返回空 */
export async function loadPersistedStore(): Promise<PersistedStoreShape> {
  const empty: PersistedStoreShape = { version: 1, sessions: {} }
  if (!storePath) return empty
  try {
    const raw = await fs.readFile(storePath, 'utf-8')
    const parsed = JSON.parse(raw) as PersistedStoreShape
    if (!parsed || parsed.version !== 1 || typeof parsed.sessions !== 'object') return empty
    return parsed
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') {
      console.warn('[ToolSession] 状态读取失败，按空处理:', (e as Error).message)
    }
    return empty
  }
}

/** 原子写入（tmp + rename），避免读到半截文件 */
async function atomicWrite(file: string, content: string): Promise<void> {
  const tmp = `${file}.${process.pid}.tmp`
  await fs.writeFile(tmp, content, 'utf-8')
  try {
    await fs.rename(tmp, file)
  } catch (e) {
    await fs.unlink(tmp).catch(() => {})
    throw e
  }
}

/**
 * 会话工具状态存储。
 *
 * 内存为主、异步落盘为辅：读路径零 IO，写路径防抖。
 */
export class ToolSessionStore {
  private sessions = new Map<string, PersistedSessionState>()
  private loaded = false
  private dirty = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private flushing: Promise<void> | null = null

  /** 首次访问时从磁盘加载（惰性，避免构造期做 IO） */
  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return
    const data = await loadPersistedStore()
    for (const [sid, st] of Object.entries(data.sessions)) {
      this.sessions.set(sid, {
        active: Array.isArray(st.active) ? [...st.active] : [],
        roleId: typeof st.roleId === 'string' ? st.roleId : 'default',
        lastUsed: st.lastUsed && typeof st.lastUsed === 'object' ? { ...st.lastUsed } : {},
        updatedAt: typeof st.updatedAt === 'number' ? st.updatedAt : Date.now(),
      })
    }
    this.loaded = true
  }

  /** 同步取状态（用于已经在内存的快速路径）；不存在则返回 undefined */
  peek(sessionId: string): PersistedSessionState | undefined {
    return this.sessions.get(sessionId)
  }

  /** 取或建状态 */
  async get(sessionId: string): Promise<PersistedSessionState> {
    await this.ensureLoaded()
    let s = this.sessions.get(sessionId)
    if (!s) {
      s = { active: [], roleId: 'default', lastUsed: {}, updatedAt: Date.now() }
      this.sessions.set(sessionId, s)
    }
    return s
  }

  /** 标记有改动并安排防抖落盘 */
  markDirty(): void {
    this.dirty = true
    if (!storePath) return
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, PERSIST_DEBOUNCE_MS)
    this.timer.unref?.()
  }

  /** 立即落盘（应用退出前调用，避免丢最后几次改动） */
  async flush(): Promise<void> {
    if (!this.dirty || !storePath) return
    if (this.flushing) return this.flushing

    const snapshot: PersistedStoreShape = { version: 1, sessions: {} }
    // 按 updatedAt 淘汰最旧会话
    const entries = [...this.sessions.entries()].sort((a, b) => b[1].updatedAt - a[1].updatedAt)
    for (const [sid, st] of entries.slice(0, MAX_SESSIONS)) {
      // 裁剪 lastUsed
      const lu = Object.entries(st.lastUsed)
      const trimmed = lu.length > MAX_LAST_USED_ENTRIES
        ? Object.fromEntries(
            lu.sort((a, b) => b[1] - a[1]).slice(0, MAX_LAST_USED_ENTRIES),
          )
        : st.lastUsed
      snapshot.sessions[sid] = { ...st, lastUsed: trimmed }
    }

    this.dirty = false
    this.flushing = (async () => {
      try {
        await fs.mkdir(path.dirname(storePath!), { recursive: true })
        await atomicWrite(storePath!, JSON.stringify(snapshot, null, 2))
      } catch (e) {
        // 落盘失败：恢复脏标记，等下次再试。绝不能因为 IO 失败就丢掉状态。
        this.dirty = true
        console.warn('[ToolSession] 状态落盘失败:', (e as Error).message)
      } finally {
        this.flushing = null
      }
    })()
    return this.flushing
  }

  /** 删除某会话的状态 */
  async remove(sessionId: string): Promise<void> {
    await this.ensureLoaded()
    if (this.sessions.delete(sessionId)) this.markDirty()
  }

  /**
   * 同步落盘 —— 专供应用退出路径使用。
   *
   * 退出时没有机会 await 异步写，而防抖队列里可能还压着最后几秒的改动
   * （用户刚 tool_load 的工具）。此处用同步 IO 做最后一次保存。
   */
  flushSync(): void {
    if (!this.dirty || !storePath) return
    try {
      const snapshot: PersistedStoreShape = { version: 1, sessions: {} }
      const entries = [...this.sessions.entries()].sort((a, b) => b[1].updatedAt - a[1].updatedAt)
      for (const [sid, st] of entries.slice(0, MAX_SESSIONS)) {
        snapshot.sessions[sid] = st
      }
      mkdirSync(path.dirname(storePath), { recursive: true })
      const tmp = `${storePath}.${process.pid}.tmp`
      writeFileSync(tmp, JSON.stringify(snapshot, null, 2), 'utf-8')
      renameSync(tmp, storePath)
      this.dirty = false
    } catch (e) {
      console.warn('[ToolSession] 退出前落盘失败:', (e as Error).message)
      try {
        unlinkSync(`${storePath}.${process.pid}.tmp`)
      } catch {
        /* 临时文件可能不存在 */
      }
    }
  }

  /** 测试/诊断用：当前内存中的会话数 */
  size(): number {
    return this.sessions.size
  }
}

/** 全局单例（主进程内共享） */
export const toolSessionStore = new ToolSessionStore()

/**
 * 从对话历史反扫，重建活跃工具集。
 *
 * 扫两类痕迹：
 *   1. `tool_use` 内容块 —— 模型实际调用过的工具（最可靠的事实来源）
 *   2. JSON 文本里形如 `{"type":"tool_use","name":"..."}` 的片段
 *      （历史可能是被序列化成字符串存下来的）
 *
 * 只保留同时存在于 `availableTools` 里的名字 —— 历史里可能有已删除的工具，
 * 把它们写进活跃集只会让后续构建上下文时找不到定义。
 *
 * @param messages       对话消息（任意形态，内部做容错）
 * @param availableTools 当前可用的工具名/ID 集合
 */
export function deriveActiveToolsFromMessages(
  messages: readonly unknown[],
  availableTools: ReadonlySet<string>,
): string[] {
  const found = new Set<string>()

  const visit = (node: unknown, depth: number): void => {
    if (node == null || depth > 8) return

    if (typeof node === 'string') {
      // 字符串里可能是序列化过的消息：抓 tool_use 的 name 字段
      for (const m of node.matchAll(/"type"\s*:\s*"tool_use"[\s\S]{0,200}?"name"\s*:\s*"([^"]+)"/g)) {
        found.add(m[1])
      }
      return
    }

    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1)
      return
    }

    if (typeof node !== 'object') return
    const obj = node as Record<string, unknown>

    // Anthropic 风格内容块
    if (obj.type === 'tool_use' && typeof obj.name === 'string') {
      found.add(obj.name)
    }
    // OpenAI 风格 tool_calls
    if (Array.isArray(obj.tool_calls)) {
      for (const tc of obj.tool_calls) {
        const fn = (tc as Record<string, unknown>)?.function as Record<string, unknown> | undefined
        if (fn && typeof fn.name === 'string') found.add(fn.name)
      }
    }

    for (const v of Object.values(obj)) visit(v, depth + 1)
  }

  for (const msg of messages) visit(msg, 0)

  // 只保留当前仍可用的
  const result: string[] = []
  for (const name of found) {
    if (availableTools.has(name)) result.push(name)
  }
  return result
}

/**
 * 合并「落盘的活跃集」与「历史推导出的活跃集」。
 *
 * 取并集：落盘代表了用户的显式意图（tool_load 进来的），
 * 历史代表实际发生过的事实（模型调用过的）。两者都不该丢。
 *
 * ⚠️ **两套标识符不对等**，必须分别过滤：
 * - `persisted` 存的是 `tool.id`（见 toolMetaTools.loadTools：`state.active.add(tool.id)`）
 * - `derived` 存的是 `tool.name`（历史里的 `tool_use.name`）
 *
 * 当前内置工具满足 `id === name`（toolManager 同步时 `id: cmd.name`），
 * 所以两者恰好可以互换 —— 但这是**隐含约定，不是契约**。
 * 若将来允许自定义 id，用单一集合过滤会让一侧被整体丢弃（静默失效）。
 *
 * @param availableIds   可用工具 id 集合，用于过滤 persisted
 * @param availableNames 可用工具名集合，用于过滤 derived
 */
export function mergeActiveTools(
  persisted: readonly string[],
  derived: readonly string[],
  availableIds: ReadonlySet<string>,
  availableNames: ReadonlySet<string>,
): string[] {
  const out = new Set<string>()
  for (const id of persisted) {
    if (availableIds.has(id)) out.add(id)
  }
  for (const name of derived) {
    // derived 是工具名；若同时存在于 id 集合则按 id 归一，避免同一工具出现两种写法
    if (availableIds.has(name)) out.add(name)
    else if (availableNames.has(name)) out.add(name)
  }
  return [...out]
}
