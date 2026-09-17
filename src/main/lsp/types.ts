/**
 * src/main/lsp/types.ts — LSP 类型定义
 *
 * 移植自 D:\src\services\lsp\types.ts 并扩展：原文 ScopedLspServerConfig 裸为
 * Record<string,unknown>，但 LSPServerInstance/LSPServerManager 实际访问具体字段
 * （command/args/env/workspaceFolder/extensionToLanguage/initializationOptions/
 * startupTimeout/maxRestarts/etc.）。为类型安全，此处给出 K 用的完整结构。
 */

/** 单个文件扩展名 → 语言 ID 的映射。如 { '.ts': 'typescript' } */
export type ExtensionToLanguage = Record<string, string>

/**
 * LSP 服务器配置（K 版本地结构；D:\src 原由插件系统提供，K 改由配置源注入）。
 * 命令/参数/环境需求自私有，扩展名转语言 ID 决定文件路由。
 */
export interface LspServerConfig {
  /** 可执行命令（必填） */
  command: string
  /** 启动参数 */
  args: string[]
  /** 额外环境变量 */
  env?: Record<string, string>
  /** 工作区/根目录（默认 process.cwd()） */
  workspaceFolder?: string
  /** 文件扩展名 → 语言 ID，用于 getServerForFile 路由 */
  extensionToLanguage: ExtensionToLanguage
  /** 传给服务器 initialize 的 initializationOptions */
  initializationOptions?: Record<string, unknown>
  /** 服务器启动超时 ms（可选） */
  startupTimeout?: number
  /** 崩溃/重启 最大次数（默认 3） */
  maxRestarts?: number
  /** 未实现，显式禁用 */
  restartOnCrash?: undefined
  /** 未实现，显式禁用 */
  shutdownTimeout?: undefined
}

/** 单台服务器状态（与 D:\src 行为一致） */
export type LspServerState =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'error'

/** 兼容别名（旧 ScopedLspServerConfig） */
export type ScopedLspServerConfig = LspServerConfig