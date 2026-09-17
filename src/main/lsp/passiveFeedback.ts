/**
 * src/main/lsp/passiveFeedback.ts — LSP 诊断被动反馈（移植自 D:\src\services\lsp\passiveFeedback.ts）
 *
 * 给每台 LSP 服务器注册 textDocument/publishDiagnostics 处理器，把服务器被动推送的
 * 诊断转成 K 的 DiagnosticFile 结构并送进 LSPDiagnosticRegistry 供上层取用。
 *
 * 适配：DiagnosticFile 类型取自本目录 LSPDiagnosticRegistry；日志 → logManager。
 */
import { fileURLToPath } from 'node:url'
import type { PublishDiagnosticsParams } from 'vscode-languageserver-protocol'
import { logManager } from '../logger/manager'
import { registerPendingLSPDiagnostic, type DiagnosticFile } from './LSPDiagnosticRegistry'
import type { LSPServerManager } from './LSPServerManager'

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
function debug(m: string): void {
  logManager?.log('debug', m)
}
function errLog(m: string): void {
  logManager?.log('error', m)
}

/** LSP 严重度数字 → 可读字符串（1=Error..4=Hint），非法/缺失回退 Error */
function mapLSPSeverity(lspSeverity: number | undefined): 'Error' | 'Warning' | 'Info' | 'Hint' {
  switch (lspSeverity) {
    case 1: return 'Error'
    case 2: return 'Warning'
    case 3: return 'Info'
    case 4: return 'Hint'
    default: return 'Error'
  }
}

/** 把 LSP PublishDiagnosticsParams 转成 DiagnosticFile[] */
export function formatDiagnosticsForAttachment(params: PublishDiagnosticsParams): DiagnosticFile[] {
  let uri: string
  try {
    uri = params.uri.startsWith('file://') ? fileURLToPath(params.uri) : params.uri
  } catch {
    uri = params.uri
  }
  const diagnostics = params.diagnostics.map((diag) => ({
    message: diag.message,
    severity: mapLSPSeverity(diag.severity),
    range: {
      start: { line: diag.range.start.line, character: diag.range.start.character },
      end: { line: diag.range.end.line, character: diag.range.end.character },
    },
    source: diag.source,
    code:
      diag.code !== undefined && diag.code !== null ? String(diag.code) : undefined,
  }))
  return [{ uri, diagnostics }]
}

export type HandlerRegistrationResult = {
  totalServers: number
  successCount: number
  registrationErrors: Array<{ serverName: string; error: string }>
  diagnosticFailures: Map<string, { count: number; lastError: string }>
}

/** 给所有服务器注册 publishDiagnostics 处理器，送进 registry */
export function registerLSPNotificationHandlers(manager: LSPServerManager): HandlerRegistrationResult {
  const servers = manager.getAllServers()
  const registrationErrors: Array<{ serverName: string; error: string }> = []
  let successCount = 0
  const diagnosticFailures: Map<string, { count: number; lastError: string }> = new Map()

  for (const [serverName, serverInstance] of servers.entries()) {
    try {
      if (!serverInstance || typeof serverInstance.onNotification !== 'function') {
        const msg = !serverInstance ? '服务器实例为 null/undefined' : '服务器实例缺少 onNotification 方法'
        registrationErrors.push({ serverName, error: msg })
        errLog(`${msg} for ${serverName}`)
        continue
      }
      serverInstance.onNotification('textDocument/publishDiagnostics', (params) => {
        try {
          const files = formatDiagnosticsForAttachment(params as PublishDiagnosticsParams)
          registerPendingLSPDiagnostic({ serverName, files })
          diagnosticFailures.delete(serverName)
        } catch (error) {
          const current = diagnosticFailures.get(serverName) || { count: 0, lastError: '' }
          current.count++
          current.lastError = errMsg(error)
          diagnosticFailures.set(serverName, current)
          errLog(`处理 ${serverName} 的 publishDiagnostics 失败: ${errMsg(error)}`)
        }
      })
      successCount++
    } catch (error) {
      registrationErrors.push({ serverName, error: errMsg(error) })
      errLog(`注册 ${serverName} 的通知处理器失败: ${errMsg(error)}`)
    }
  }

  debug(`LSP 诊断处理器注册完成: ${successCount}/${servers.size}`)
  return { totalServers: servers.size, successCount, registrationErrors, diagnosticFailures }
}