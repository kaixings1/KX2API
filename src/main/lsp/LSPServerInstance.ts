/**
 * src/main/lsp/LSPServerInstance.ts — 单台 LSP 服务器实例（移植自 D:\src\services\lsp\LSPServerInstance.ts）
 *
 * 状态机：stopped→starting→running；running→stopping→stopped；any→error；error→starting(重试)。
 * 含崩溃恢复上限、ContentModified 瞬时错误指数退避重试（rust-analyzer 建索引场景）。
 *
 * 适配（相对原文）：
 *   - getCwd() → process.cwd()
 *   - sleep()  → 内联 kSleep
 *   - logError/logForDebugging/errorMessage → logManager.error/debug + errMsg()
 */
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { InitializeParams } from 'vscode-languageserver-protocol'
import { logManager } from '../logger/manager'
import { createLSPClient, type LSPClient } from './LSPClient'
import type { LspServerConfig, LspServerState } from './types'

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
function debug(m: string): void {
  logManager?.log('debug', m)
}
function errLog(m: string): void {
  logManager?.log('error', m)
}
function kSleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

/** LSP 错误码：内容已修改，瞬时错误可重试 */
const LSP_ERROR_CONTENT_MODIFIED = -32801
const MAX_RETRIES_FOR_TRANSIENT_ERRORS = 3
const RETRY_BASE_DELAY_MS = 500

export type LSPServerInstance = {
  readonly name: string
  readonly config: LspServerConfig
  readonly state: LspServerState
  readonly startTime: Date | undefined
  readonly lastError: Error | undefined
  readonly restartCount: number
  start(): Promise<void>
  stop(): Promise<void>
  restart(): Promise<void>
  isHealthy(): boolean
  sendRequest<T>(method: string, params: unknown): Promise<T>
  sendNotification(method: string, params: unknown): Promise<void>
  onNotification(method: string, handler: (params: unknown) => void): void
  onRequest<TParams, TResult>(
    method: string,
    handler: (params: TParams) => TResult | Promise<TResult>,
  ): void
}

/**
 * 创建并管理单台 LSP 服务器实例。
 * 闭包封装状态，提供状态跟踪、健康监测、请求转发。
 */
export function createLSPServerInstance(
  name: string,
  config: LspServerConfig,
): LSPServerInstance {
  // 未实现字段防御
  if (config.restartOnCrash !== undefined) {
    throw new Error(`LSP server '${name}': restartOnCrash is not yet implemented.`)
  }
  if (config.shutdownTimeout !== undefined) {
    throw new Error(`LSP server '${name}': shutdownTimeout is not yet implemented.`)
  }

  let state: LspServerState = 'stopped'
  let startTime: Date | undefined
  let lastError: Error | undefined
  let restartCount = 0
  let crashRecoveryCount = 0

  const client: LSPClient = createLSPClient(name, error => {
    state = 'error'
    lastError = error
    crashRecoveryCount++
  })

  async function start(): Promise<void> {
    if (state === 'running' || state === 'starting') return

    const maxRestarts = config.maxRestarts ?? 3
    if (state === 'error' && crashRecoveryCount > maxRestarts) {
      const e = new Error(`LSP 服务器 '${name}' 超过最大崩溃恢复尝试次数 (${maxRestarts})`)
      lastError = e
      errLog(e.message)
      throw e
    }

    let initPromise: Promise<unknown> | undefined
    try {
      state = 'starting'
      debug(`正在启动 LSP 服务器实例: ${name}`)
      await client.start(config.command, config.args || [], {
        env: config.env,
        cwd: config.workspaceFolder,
      })

      const workspaceFolder = config.workspaceFolder || process.cwd()
      const workspaceUri = pathToFileURL(workspaceFolder).href

      const initParams: InitializeParams = {
        processId: process.pid,
        initializationOptions: config.initializationOptions ?? {},
        workspaceFolders: [
          { uri: workspaceUri, name: path.basename(workspaceFolder) },
        ],
        rootPath: workspaceFolder,
        rootUri: workspaceUri,
        capabilities: {
          workspace: {
            configuration: false,
            workspaceFolders: false,
          },
          textDocument: {
            synchronization: {
              dynamicRegistration: false,
              willSave: false,
              willSaveWaitUntil: false,
              didSave: true,
            },
            publishDiagnostics: {
              relatedInformation: true,
              tagSupport: { valueSet: [1, 2] },
              versionSupport: false,
              codeDescriptionSupport: true,
              dataSupport: false,
            },
            hover: {
              dynamicRegistration: false,
              contentFormat: ['markdown', 'plaintext'],
            },
            definition: { dynamicRegistration: false, linkSupport: true },
            references: { dynamicRegistration: false },
            documentSymbol: {
              dynamicRegistration: false,
              hierarchicalDocumentSymbolSupport: true,
            },
            callHierarchy: { dynamicRegistration: false },
          },
          general: { positionEncodings: ['utf-16'] },
        },
      }

      initPromise = client.initialize(initParams)
      if (config.startupTimeout !== undefined) {
        await withTimeout(
          initPromise,
          config.startupTimeout,
          `LSP 服务器 '${name}' 在初始化期间超时，经过 ${config.startupTimeout}ms`,
        )
      } else {
        await initPromise
      }

      state = 'running'
      startTime = new Date()
      crashRecoveryCount = 0
      debug(`LSP 服务器实例已启动: ${name}`)
    } catch (error) {
      client.stop().catch(() => {})
      initPromise?.catch(() => {})
      state = 'error'
      lastError = error as Error
      errLog((error as Error).message)
      throw error
    }
  }

  async function stop(): Promise<void> {
    if (state === 'stopped' || state === 'stopping') return
    try {
      state = 'stopping'
      await client.stop()
      state = 'stopped'
      debug(`LSP 服务器实例已停止: ${name}`)
    } catch (error) {
      state = 'error'
      lastError = error as Error
      errLog((error as Error).message)
      throw error
    }
  }

  async function restart(): Promise<void> {
    try {
      await stop()
    } catch (error) {
      const se = new Error(`重启期间停止 LSP 服务器 '${name}' 失败: ${errMsg(error)}`)
      errLog(se.message)
      throw se
    }
    restartCount++
    const maxRestarts = config.maxRestarts ?? 3
    if (restartCount > maxRestarts) {
      const e = new Error(`Max restart attempts (${maxRestarts}) exceeded for server '${name}'`)
      errLog(e.message)
      throw e
    }
    try {
      await start()
    } catch (error) {
      const se = new Error(`Failed to start LSP server '${name}' during restart (${restartCount}/${maxRestarts}): ${errMsg(error)}`)
      errLog(se.message)
      throw se
    }
  }

  function isHealthy(): boolean {
    return state === 'running' && client.isInitialized
  }

  async function sendRequest<T>(method: string, params: unknown): Promise<T> {
    if (!isHealthy()) {
      const e = new Error(
        `无法向 LSP 服务器 '${name}' 发送请求：服务器状态为 ${state}` +
          `${lastError ? `, last error: ${lastError.message}` : ''}`,
      )
      errLog(e.message)
      throw e
    }
    let lastAttemptError: Error | undefined
    for (let attempt = 0; attempt <= MAX_RETRIES_FOR_TRANSIENT_ERRORS; attempt++) {
      try {
        return await client.sendRequest(method, params)
      } catch (error) {
        lastAttemptError = error as Error
        const errorCode = (error as { code?: number }).code
        const isContentModifiedError =
          typeof errorCode === 'number' && errorCode === LSP_ERROR_CONTENT_MODIFIED
        if (isContentModifiedError && attempt < MAX_RETRIES_FOR_TRANSIENT_ERRORS) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt)
          debug(
            `LSP request '${method}' to '${name}' got ContentModified error, retrying in ${delay}ms`,
          )
          await kSleep(delay)
          continue
        }
        break
      }
    }
    const re = new Error(`LSP request '${method}' failed for server '${name}': ${lastAttemptError?.message ?? 'unknown'}`)
    errLog(re.message)
    throw re
  }

  async function sendNotification(method: string, params: unknown): Promise<void> {
    if (!isHealthy()) {
      const e = new Error(`无法向 LSP 服务器 '${name}' 发送通知：服务器状态为 ${state}`)
      errLog(e.message)
      throw e
    }
    try {
      await client.sendNotification(method, params)
    } catch (error) {
      const ne = new Error(`LSP notification '${method}' failed for server '${name}': ${errMsg(error)}`)
      errLog(ne.message)
      throw ne
    }
  }

  function onNotification(method: string, handler: (params: unknown) => void): void {
    client.onNotification(method, handler)
  }
  function onRequest<TParams, TResult>(
    method: string,
    handler: (params: TParams) => TResult | Promise<TResult>,
  ): void {
    client.onRequest(method, handler)
  }

  return {
    name,
    config,
    get state() { return state },
    get startTime() { return startTime },
    get lastError() { return lastError },
    get restartCount() { return restartCount },
    start,
    stop,
    restart,
    isHealthy,
    sendRequest,
    sendNotification,
    onNotification,
    onRequest,
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout((rej: (e: Error) => void, msg: string) => rej(new Error(msg)), ms, reject, message)
  })
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer!))
}