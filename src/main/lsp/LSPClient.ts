/**
 * src/main/lsp/LSPClient.ts — LSP 客户端（移植自 D:\src\services\lsp\LSPClient.ts）
 *
 * 通过 stdio + JSON-RPC 与语言服务器进程通信。纯协议逻辑，可复用。
 *
 * 适配层（相对 D:\src 原文）：
 *   - logForDebugging  → logManager.debug(msg)             （KX2API src/main/logger/manager）
 *   - logError(err)    → logManager.error(err.message)      （按 K 的 LogManager 签名）
 *   - errorMessage     → kErrMsg（内联，err instanceof Error ? err.message : String(err)）
 *   - subprocessEnv()  → process.env（K 无该工具；LSP 服务器继承宿主环境即可）
 *
 * 依赖（需安装，均为标准 npm 包）：
 *   - vscode-jsonrpc                 ：JSON-RPC 连接层（node 子路径）
 *   - vscode-languageserver-protocol ：LSP 协议类型（InitializeParams/Result/ServerCapabilities）
 */
import { spawn, type ChildProcess } from 'node:child_process'
import {
  createMessageConnection,
  type MessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  Trace,
} from 'vscode-jsonrpc/node'
import type {
  InitializeParams,
  InitializeResult,
  ServerCapabilities,
} from 'vscode-languageserver-protocol'
import { logManager } from '../logger/manager'

/** 把未知错误归一成消息字符串（等价 D:\src 的 errorMessage） */
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function debug(msg: string): void {
  logManager?.log('debug', msg)
}

function errLog(msg: string): void {
  logManager?.log('error', msg)
}

/**
 * LSP 客户端接口。管理与 LSP 服务器进程的 stdio 通信。
 */
export type LSPClient = {
  readonly capabilities: ServerCapabilities | undefined
  readonly isInitialized: boolean
  start: (
    command: string,
    args: string[],
    options?: { env?: Record<string, string>; cwd?: string },
  ) => Promise<void>
  initialize: (params: InitializeParams) => Promise<InitializeResult>
  sendRequest: <TResult>(method: string, params: unknown) => Promise<TResult>
  sendNotification: (method: string, params: unknown) => Promise<void>
  onNotification: (method: string, handler: (params: unknown) => void) => void
  onRequest: <TParams, TResult>(
    method: string,
    handler: (params: TParams) => TResult | Promise<TResult>,
  ) => void
  stop: () => Promise<void>
}

/**
 * Create an LSP client wrapper using vscode-jsonrpc.
 * Manages communication with an LSP server process via stdio.
 *
 * @param serverName - 服务器名（用于日志标识）
 * @param onCrash - 服务器进程异常退出（非主动 stop）时回调，供上层重启
 */
export function createLSPClient(
  serverName: string,
  onCrash?: (error: Error) => void,
): LSPClient {
  // 闭包状态
  let process: ChildProcess | undefined
  let connection: MessageConnection | undefined
  let capabilities: ServerCapabilities | undefined
  let isInitialized = false
  let startFailed = false
  let startError: Error | undefined
  let isStopping = false

  // 连接就绪前注册的 handler 队列（支持懒初始化）
  const pendingHandlers: Array<{ method: string; handler: (params: unknown) => void }> = []
  const pendingRequestHandlers: Array<{
    method: string
    handler: (params: unknown) => unknown | Promise<unknown>
  }> = []

  function checkStartFailed(): void {
    if (startFailed) {
      throw startError || new Error(`LSP 服务器 ${serverName} 启动失败`)
    }
  }

  return {
    get capabilities(): ServerCapabilities | undefined {
      return capabilities
    },

    get isInitialized(): boolean {
      return isInitialized
    },

    async start(
      command: string,
      args: string[],
      options?: { env?: Record<string, string>; cwd?: string },
    ): Promise<void> {
      try {
        // 1. Spawn LSP server process
        process = spawn(command, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...globalThis.process.env, ...options?.env },
          cwd: options?.cwd,
          // Prevent visible console window on Windows (no-op on other platforms)
          windowsHide: true,
        })

        if (!process.stdout || !process.stdin) {
          throw new Error('LSP 服务器进程 stdio 不可用')
        }

        // 1.5. Wait for process to successfully spawn before using streams.
        // spawn() 立即返回，但 'error'（如 ENOENT）异步触发；若不等待，会在无效流上写。
        const spawnedProcess = process
        await new Promise<void>((resolve, reject) => {
          const onSpawn = (): void => { cleanup(); resolve() }
          const onError = (error: Error): void => { cleanup(); reject(error) }
          const cleanup = (): void => {
            spawnedProcess.removeListener('spawn', onSpawn)
            spawnedProcess.removeListener('error', onError)
          }
          spawnedProcess.once('spawn', onSpawn)
          spawnedProcess.once('error', onError)
        })

        // 2. Capture stderr for server diagnostics
        if (process.stderr) {
          process.stderr.on('data', (data: Buffer) => {
            const output = data.toString().trim()
            if (output) debug(`[LSP SERVER ${serverName}] ${output}`)
          })
        }

        // 3. Process errors after successful spawn (crash during operation)
        process.on('error', (error) => {
          if (!isStopping) {
            startFailed = true
            startError = error
            errLog(`LSP 服务器 ${serverName} 启动失败: ${error.message}`)
          }
        })

        process.on('exit', (code, _signal) => {
          if (code !== 0 && code !== null && !isStopping) {
            isInitialized = false
            startFailed = false
            startError = undefined
            const crashError = new Error(`LSP 服务器 ${serverName} 崩溃，退出码 ${code}`)
            errLog(crashError.message)
            onCrash?.(crashError)
          }
        })

        // stdin 流错误：防止服务器先退时未处理的 promise rejection
        process.stdin.on('error', (error: Error) => {
          if (!isStopping) debug(`LSP 服务器 ${serverName} stdin 错误: ${error.message}`)
        })

        // 4. Create JSON-RPC connection
        const reader = new StreamMessageReader(process.stdout)
        const writer = new StreamMessageWriter(process.stdin)
        connection = createMessageConnection(reader, writer)

        // 4.5. Register error/close handlers BEFORE listen()
        connection.onError(([error]) => {
          if (!isStopping) {
            startFailed = true
            startError = error
            errLog(`LSP 服务器 ${serverName} 连接错误: ${error.message}`)
          }
        })

        connection.onClose(() => {
          if (!isStopping) {
            isInitialized = false
            debug(`LSP 服务器 ${serverName} 连接已关闭`)
          }
        })

        // 5. Start listening
        connection.listen()

        // 5.5. Enable protocol tracing for debugging (best-effort)
        connection
          .trace(Trace.Verbose, {
            log: (message: string) => debug(`[LSP PROTOCOL ${serverName}] ${message}`),
          })
          .catch((error: Error) => {
            debug(`Failed to enable tracing for ${serverName}: ${error.message}`)
          })

        // 6. Apply queued handlers
        for (const { method, handler } of pendingHandlers) {
          connection.onNotification(method, handler)
        }
        pendingHandlers.length = 0
        for (const { method, handler } of pendingRequestHandlers) {
          connection.onRequest(method, handler)
        }
        pendingRequestHandlers.length = 0

        debug(`LSP client started for ${serverName}`)
      } catch (error) {
        const err = error as Error
        errLog(`LSP 服务器 ${serverName} 启动失败: ${err.message}`)
        throw error
      }
    },

    async initialize(params: InitializeParams): Promise<InitializeResult> {
      if (!connection) throw new Error('LSP 客户端未启动')
      checkStartFailed()
      try {
        const result: InitializeResult = await connection.sendRequest('initialize', params)
        capabilities = result.capabilities
        await connection.sendNotification('initialized', {})
        isInitialized = true
        debug(`LSP 服务器 ${serverName} 已初始化`)
        return result
      } catch (error) {
        errLog(`LSP 服务器 ${serverName} 初始化失败: ${errMsg(error)}`)
        throw error
      }
    },

    async sendRequest<TResult>(method: string, params: unknown): Promise<TResult> {
      if (!connection) throw new Error('LSP 客户端未启动')
      checkStartFailed()
      if (!isInitialized) throw new Error('LSP 服务器未初始化')
      try {
        return await connection.sendRequest(method, params)
      } catch (error) {
        errLog(`LSP 服务器 ${serverName} 请求 ${method} 失败: ${errMsg(error)}`)
        throw error
      }
    },

    async sendNotification(method: string, params: unknown): Promise<void> {
      if (!connection) throw new Error('LSP 客户端未启动')
      checkStartFailed()
      try {
        await connection.sendNotification(method, params)
      } catch (error) {
        errLog(`LSP 服务器 ${serverName} 通知 ${method} 失败: ${errMsg(error)}`)
        // 通知是 fire-and-forget，不重抛
        debug(`通知 ${method} 失败但继续`)
      }
    },

    onNotification(method: string, handler: (params: unknown) => void): void {
      if (!connection) {
        pendingHandlers.push({ method, handler })
        return
      }
      checkStartFailed()
      connection.onNotification(method, handler)
    },

    onRequest<TParams, TResult>(
      method: string,
      handler: (params: TParams) => TResult | Promise<TResult>,
    ): void {
      if (!connection) {
        pendingRequestHandlers.push({
          method,
          handler: handler as (params: unknown) => unknown | Promise<unknown>,
        })
        return
      }
      checkStartFailed()
      connection.onRequest(method, handler as (params: unknown) => unknown)
    },

    async stop(): Promise<void> {
      let shutdownError: Error | undefined
      isStopping = true

      try {
        if (connection) {
          await connection.sendRequest('shutdown', {})
          await connection.sendNotification('exit', {})
        }
      } catch (error) {
        errLog(`LSP 服务器 ${serverName} 停止失败: ${errMsg(error)}`)
        shutdownError = error as Error
      } finally {
        if (connection) {
          try { connection.dispose() } catch (error) {
            debug(`Connection disposal failed for ${serverName}: ${errMsg(error)}`)
          }
          connection = undefined
        }
        if (process) {
          process.removeAllListeners('error')
          process.removeAllListeners('exit')
          process.stdin?.removeAllListeners('error')
          process.stderr?.removeAllListeners('data')
          try { process.kill() } catch { debug(`Process kill failed for ${serverName}`) }
          process = undefined
        }
        isInitialized = false
        capabilities = undefined
        isStopping = false
        if (shutdownError) {
          startFailed = true
          startError = shutdownError
        }
        debug(`LSP client stopped for ${serverName}`)
      }
      if (shutdownError) throw shutdownError
    },
  }
}