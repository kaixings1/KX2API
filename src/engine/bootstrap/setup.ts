/**
 * engine/bootstrap/setup.ts — 系统初始化入口
 *
 * 吸收自 D:\src\setup.ts 的 setup() 能力。
 * KX2API 为 Electron 桌面应用，职责精简为：
 * - 会话记忆初始化
 * - 钩子系统初始化
 * - 插件预加载
 */

import { SessionMemory } from '../memory/sessionMemory.js'

/**
 * 系统初始化
 */
export async function setup(sessionId?: string): Promise<void> {
  // 初始化会话记忆（SessionMemory 实例在 engine 中按需创建）
  // TODO: 集成到引擎生命周期

  // 插件预加载由 engine init() 处理
}
