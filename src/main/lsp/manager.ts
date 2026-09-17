/**
 * src/main/lsp/manager.ts — LSP 服务器管理器单例（移植自 D:\src\services\lsp\manager.ts）
 *
 * K 侧简化版：不依赖 Claude Code 的 bare mode / 插件刷新生命周期，改由 K 主进程显式
 * initializeLspServerManager() 启动、shutdownLspServerManager() 关闭。配置通过
 * setLspServerConfigs() 注入（K 后续可接配置 UI / 工具链路），不在本文件内耦合具体源。
 *
 * 线程安全：单例 + generation 计数防止过期的初始化 promise 覆盖新状态。
 */
import { logManager } from '../logger/manager'
import {
  createLSPServerManager,
  type LSPServerManager,
} from './LSPServerManager'
import type { LspServerConfig } from './types'
import { registerLSPNotificationHandlers } from './passiveFeedback'

type InitializationState = 'not-started' | 'pending' | 'success' | 'failed'

let lspManagerInstance: LSPServerManager | undefined
let initializationState: InitializationState = 'not-started'
let initializationError: Error | undefined
let initializationGeneration = 0
let initializationPromise: Promise<void> | undefined

/** 供上层注入的服务器配置（调用 initialize 前设置）。默认为空。 */
let lspServers: Record<string, LspServerConfig> = {}

/** 设置 LSP 服务器配置映射（调用方在 initialize 前注入；可多次覆盖）。 */
export function setLspServers(servers: Record<string, LspServerConfig>): void {
  lspServers = servers
}

/** 测试/重置用：仅清模块级单例状态，不关真实连接。 */
export function _resetLspManagerForTesting(): void {
  initializationState = 'not-started'
  initializationError = undefined
  initializationPromise = undefined
  initializationGeneration++
}

export function getLspServerManager(): LSPServerManager | undefined {
  if (initializationState === 'failed') return undefined
  return lspManagerInstance
}

export function getInitializationStatus():
  | { status: 'not-started' }
  | { status: 'pending' }
  | { status: 'success' }
  | { status: 'failed'; error: Error } {
  if (initializationState === 'failed')
    return { status: 'failed', error: initializationError || new Error('初始化失败') }
  if (initializationState === 'not-started') return { status: 'not-started' }
  if (initializationState === 'pending') return { status: 'pending' }
  return { status: 'success' }
}

export function isLspConnected(): boolean {
  if (initializationState === 'failed') return false
  const manager = getLspServerManager()
  if (!manager) return false
  const servers = manager.getAllServers()
  if (servers.size === 0) return false
  for (const server of servers.values()) {
    if (server.state !== 'error') return true
  }
  return false
}

export async function waitForInitialization(): Promise<void> {
  if (initializationState === 'success' || initializationState === 'failed') return
  if (initializationState === 'pending' && initializationPromise) {
    await initializationPromise
  }
}

export function initializeLspServerManager(): void {
  if (lspManagerInstance !== undefined && initializationState !== 'failed') return
  if (initializationState === 'failed') {
    lspManagerInstance = undefined
    initializationError = undefined
  }

  lspManagerInstance = createLSPServerManager(async () => ({ servers: lspServers }))
  initializationState = 'pending'
  const currentGeneration = ++initializationGeneration

  initializationPromise = lspManagerInstance
    .initialize()
    .then(() => {
      if (currentGeneration === initializationGeneration) {
        initializationState = 'success'
        registerLSPNotificationHandlers(lspManagerInstance!)
      }
    })
    .catch((error: unknown) => {
      if (currentGeneration === initializationGeneration) {
        initializationState = 'failed'
        initializationError = error as Error
        lspManagerInstance = undefined
        logManager?.log('error', `初始化 LSP 服务器管理器失败: ${(error as Error).message}`)
      }
    })
}

export async function shutdownLspServerManager(): Promise<void> {
  if (lspManagerInstance === undefined) return
  try {
    await lspManagerInstance.shutdown()
  } catch (error) {
    logManager?.log('error', `关闭 LSP 服务器管理器失败: ${(error as Error).message}`)
  } finally {
    lspManagerInstance = undefined
    initializationState = 'not-started'
    initializationError = undefined
    initializationPromise = undefined
    initializationGeneration++
  }
}