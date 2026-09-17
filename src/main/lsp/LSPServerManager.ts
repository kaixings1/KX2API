/**
 * src/main/lsp/LSPServerManager.ts — LSP 服务器管理器（移植自 D:\src\services\lsp\LSPServerManager.ts）
 *
 * 管理多台 LSP 服务器实例，按文件扩展名路由请求，并同步文件打开/变更/保存/关闭
 * 状态（didOpen/didChange/didSave/didClose）以触发诊断。
 *
 * 适配（相对原文）：
 *   - getAllLspServers() 是插件耦合，改为「配置加载器注入」（loadServers 参数）——
 *     K 没有 Claude Code 插件系统，由上层传入 LspServerConfig 映射。
 *   - 日志全部改为 logManager + errMsg()。
 */
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { logManager } from '../logger/manager'
import { createLSPServerInstance, type LSPServerInstance } from './LSPServerInstance'
import type { LspServerConfig } from './types'

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
function debug(m: string): void {
  logManager?.log('debug', m)
}
function errLog(m: string): void {
  logManager?.log('error', m)
}

export type LSPServerManager = {
  initialize(): Promise<void>
  shutdown(): Promise<void>
  getServerForFile(filePath: string): LSPServerInstance | undefined
  ensureServerStarted(filePath: string): Promise<LSPServerInstance | undefined>
  sendRequest<T>(filePath: string, method: string, params: unknown): Promise<T | undefined>
  getAllServers(): Map<string, LSPServerInstance>
  openFile(filePath: string, content: string): Promise<void>
  changeFile(filePath: string, content: string): Promise<void>
  saveFile(filePath: string): Promise<void>
  closeFile(filePath: string): Promise<void>
  isFileOpen(filePath: string): boolean
}

/**
 * 创建 LSP 服务器管理器。
 * @param loadServers - 返回 `{ servers: Record<name, LspServerConfig> }` 的加载器，
 *   由调用方注入（K 侧读取其配置源）。默认空配置。
 */
export function createLSPServerManager(
  loadServers?: () => Promise<{ servers: Record<string, LspServerConfig> }>,
): LSPServerManager {
  const servers: Map<string, LSPServerInstance> = new Map()
  const extensionMap: Map<string, string[]> = new Map()
  const openedFiles: Map<string, string> = new Map()

  async function initialize(): Promise<void> {
    let serverConfigs: Record<string, LspServerConfig> = {}
    try {
      const result = loadServers ? await loadServers() : { servers: {} }
      serverConfigs = result.servers
      debug(`[LSP SERVER MANAGER] loadServers returned ${Object.keys(serverConfigs).length} server(s)`)
    } catch (error) {
      const err = error as Error
      errLog(`加载 LSP 服务器配置失败: ${err.message}`)
      throw error
    }

    for (const [serverName, config] of Object.entries(serverConfigs)) {
      try {
        if (!config.command) throw new Error(`服务器 ${serverName} 缺少必填字段 'command'`)
        if (!config.extensionToLanguage || Object.keys(config.extensionToLanguage).length === 0) {
          throw new Error(`服务器 ${serverName} 缺少必填字段 'extensionToLanguage'`)
        }
        const fileExtensions = Object.keys(config.extensionToLanguage)
        for (const ext of fileExtensions) {
          const normalized = ext.toLowerCase()
          if (!extensionMap.has(normalized)) extensionMap.set(normalized, [])
          extensionMap.get(normalized)!.push(serverName)
        }
        const instance = createLSPServerInstance(serverName, config)
        servers.set(serverName, instance)
        instance.onRequest(
          'workspace/configuration',
          (params: { items: Array<{ section?: string }> }) => {
            debug(`LSP: Received workspace/configuration request from ${serverName}`)
            return params.items.map(() => null)
          },
        )
      } catch (error) {
        errLog(`初始化 LSP 服务器 ${serverName} 失败: ${(error as Error).message}`)
      }
    }
    debug(`LSP 管理器初始化完成，包含 ${servers.size} 个服务器`)
  }

  async function shutdown(): Promise<void> {
    const toStop = Array.from(servers.entries()).filter(
      ([, s]) => s.state === 'running' || s.state === 'error',
    )
    const results = await Promise.allSettled(toStop.map(([, server]) => server.stop()))
    servers.clear()
    extensionMap.clear()
    openedFiles.clear()
    const errors = results
      .map((r, i) => (r.status === 'rejected' ? `${toStop[i]![0]}: ${errMsg(r.reason)}` : null))
      .filter((e): e is string => e !== null)
    if (errors.length > 0) {
      const e = new Error(`Failed to stop ${errors.length} LSP server(s): ${errors.join('; ')}`)
      errLog(e.message)
      throw e
    }
  }

  function getServerForFile(filePath: string): LSPServerInstance | undefined {
    const ext = path.extname(filePath).toLowerCase()
    const serverNames = extensionMap.get(ext)
    if (!serverNames || serverNames.length === 0) return undefined
    const serverName = serverNames[0]
    if (!serverName) return undefined
    return servers.get(serverName)
  }

  async function ensureServerStarted(filePath: string): Promise<LSPServerInstance | undefined> {
    const server = getServerForFile(filePath)
    if (!server) return undefined
    if (server.state === 'stopped' || server.state === 'error') {
      try {
        await server.start()
      } catch (error) {
        errLog(`Failed to start LSP server for file ${filePath}: ${(error as Error).message}`)
        throw error
      }
    }
    return server
  }

  async function sendRequest<T>(filePath: string, method: string, params: unknown): Promise<T | undefined> {
    const server = await ensureServerStarted(filePath)
    if (!server) return undefined
    try {
      return await server.sendRequest<T>(method, params)
    } catch (error) {
      errLog(`LSP request failed for file ${filePath}, method '${method}': ${(error as Error).message}`)
      throw error
    }
  }

  function getAllServers(): Map<string, LSPServerInstance> {
    return servers
  }

  async function openFile(filePath: string, content: string): Promise<void> {
    const server = await ensureServerStarted(filePath)
    if (!server) return
    const fileUri = pathToFileURL(path.resolve(filePath)).href
    if (openedFiles.get(fileUri) === server.name) {
      debug(`LSP: File already open, skipping didOpen for ${filePath}`)
      return
    }
    const ext = path.extname(filePath).toLowerCase()
    const languageId = server.config.extensionToLanguage[ext] || 'plaintext'
    try {
      await server.sendNotification('textDocument/didOpen', {
        textDocument: { uri: fileUri, languageId, version: 1, text: content },
      })
      openedFiles.set(fileUri, server.name)
      debug(`LSP: Sent didOpen for ${filePath} (languageId: ${languageId})`)
    } catch (error) {
      const e = new Error(`同步打开文件 ${filePath} 失败: ${errMsg(error)}`)
      errLog(e.message)
      throw e
    }
  }

  async function changeFile(filePath: string, content: string): Promise<void> {
    const server = getServerForFile(filePath)
    if (!server || server.state !== 'running') return openFile(filePath, content)
    const fileUri = pathToFileURL(path.resolve(filePath)).href
    if (openedFiles.get(fileUri) !== server.name) return openFile(filePath, content)
    try {
      await server.sendNotification('textDocument/didChange', {
        textDocument: { uri: fileUri, version: 1 },
        contentChanges: [{ text: content }],
      })
      debug(`LSP: Sent didChange for ${filePath}`)
    } catch (error) {
      const e = new Error(`同步文件更改 ${filePath} 失败: ${errMsg(error)}`)
      errLog(e.message)
      throw e
    }
  }

  async function saveFile(filePath: string): Promise<void> {
    const server = getServerForFile(filePath)
    if (!server || server.state !== 'running') return
    try {
      await server.sendNotification('textDocument/didSave', {
        textDocument: { uri: pathToFileURL(path.resolve(filePath)).href },
      })
      debug(`LSP: Sent didSave for ${filePath}`)
    } catch (error) {
      const e = new Error(`同步保存文件 ${filePath} 失败: ${errMsg(error)}`)
      errLog(e.message)
      throw e
    }
  }

  async function closeFile(filePath: string): Promise<void> {
    const server = getServerForFile(filePath)
    if (!server || server.state !== 'running') return
    const fileUri = pathToFileURL(path.resolve(filePath)).href
    try {
      await server.sendNotification('textDocument/didClose', { textDocument: { uri: fileUri } })
      openedFiles.delete(fileUri)
      debug(`LSP: Sent didClose for ${filePath}`)
    } catch (error) {
      const e = new Error(`同步关闭文件 ${filePath} 失败: ${errMsg(error)}`)
      errLog(e.message)
      throw e
    }
  }

  function isFileOpen(filePath: string): boolean {
    const fileUri = pathToFileURL(path.resolve(filePath)).href
    return openedFiles.has(fileUri)
  }

  return {
    initialize,
    shutdown,
    getServerForFile,
    ensureServerStarted,
    sendRequest,
    getAllServers,
    openFile,
    changeFile,
    saveFile,
    closeFile,
    isFileOpen,
  }
}