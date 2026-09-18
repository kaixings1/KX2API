/**
 * engine/bootstrap/setup.ts — 引擎启动初始化
 *
 * 吸收自 D:\src\setup.ts 的 setup() 能力。
 *
 * KX2API 是 Electron 桌面应用，上游 setup() 里的多数职责（Node 版本检查、
 * worktree、tmux、UDS 监听、遥测）在本项目没有对应场景或已由别处承担：
 * - 工具钩子：由 `main/engine-bridge.wireToolHooks()` 注入到 ToolScheduler
 * - 权限规则：由 `main/permissions/permissionConfig` 读取并接线
 * - 会话记忆：由 `MessageLoop` 自身持有（随会话创建/丢弃，不落盘）
 *
 * 因此这里只承担「引擎层可独立完成、且必须在对话开始前就绪」的两件事：
 * 1. 确保启动宏（globalThis.MACRO）可用 —— 版本等元信息供各模块查询
 * 2. 建立工具结果落盘基线目录的兜底（未配置时用系统临时目录）
 *
 * 其余初始化保持幂等、可重复调用（引擎可能在一次进程生命周期内被重建多次）。
 */

import { ensureBootstrapMacro } from './macro.ts'
import { setToolResultsBaseDir } from '../toolResultStore.ts'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** setup 选项 */
export interface SetupOptions {
  /** 会话标识（用于日志与转录命名）；缺省不设置 */
  sessionId?: string
  /** 工具结果落盘根目录；缺省用 <tmp>/kx2-tool-results */
  toolResultsDir?: string
  /** 是否跳过宏初始化（测试中常不需要） */
  skipMacro?: boolean
}

/** 已完成初始化的会话集合（同一 sessionId 只初始化一次） */
const initializedSessions = new Set<string>()

/**
 * 引擎启动初始化。
 *
 * 幂等：同一 sessionId 重复调用直接返回；不同 sessionId 会各自初始化一次
 * （工具结果目录只设置一次，后调用不覆盖已显式配置的路径）。
 */
export async function setup(options: SetupOptions = {}): Promise<void> {
  const sessionId = options.sessionId ?? 'default'
  if (initializedSessions.has(sessionId)) return

  // 1) 启动宏：必须最先执行，后续模块可能依赖 globalThis.MACRO
  if (!options.skipMacro) {
    try {
      ensureBootstrapMacro()
    } catch {
      // 宏初始化失败不阻断启动（仅影响版本信息展示）
    }
  }

  // 2) 工具结果落盘基线目录：超大工具输出要落盘，需要有可写目录。
  //    显式传入优先；否则用系统临时目录（不污染项目目录）。
  try {
    const dir = options.toolResultsDir ?? join(tmpdir(), 'kx2-tool-results')
    setToolResultsBaseDir(dir)
  } catch {
    // 落盘配置失败不阻断：toolResultStore 内部对未配置有兜底行为
  }

  initializedSessions.add(sessionId)
}

/** 重置初始化状态（测试用） */
export function resetSetupState(): void {
  initializedSessions.clear()
}
