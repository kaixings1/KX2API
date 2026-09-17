/**
 * src/main/lsp/tool.ts — LSP 命令实现（让模型/用户在 K 的命令轮回调里使用 LSP 能力）
 *
 * 移植目标：把 D:\src\tools\LSPTool 的 10 种操作接为 K 的 registry 命令 `lsp`。
 *
 * 用法：
 *   /lsp goToDefinition <file> <line> [col]
 *   /lsp findReferences <file> <line> [col]
 *   /lsp hover <file> <line> [col]
 *   /lsp documentSymbol <file>
 *   /lsp listDiagnostics [file]
 *   /lsp workspaceSymbol
 *   （callHierarchy / incomingCalls / outgoingCalls / goToImplementation 同 definition 系）
 *
 * 通过 main/lsp 的 LSPServerManager 单例做文件路由与请求。未初始化/无服务器时返回礼貌失败。
 */
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { logManager } from '../logger/manager'
import { getLspServerManager, isLspConnected } from './manager'
import { clearAllLSPDiagnostics, checkForLSPDiagnostics, type DiagnosticFile } from './LSPDiagnosticRegistry'

export type LspOperation =
  | 'goToDefinition'
  | 'findReferences'
  | 'hover'
  | 'documentSymbol'
  | 'workspaceSymbol'
  | 'goToImplementation'
  | 'prepareCallHierarchy'
  | 'incomingCalls'
  | 'outgoingCalls'
  | 'listDiagnostics'

function debug(m: string): void {
  logManager?.log('debug', m)
}
function errLog(m: string): void {
  logManager?.log('error', m)
}

const LSP_OPERATIONS: LspOperation[] = [
  'goToDefinition',
  'findReferences',
  'hover',
  'documentSymbol',
  'workspaceSymbol',
  'goToImplementation',
  'prepareCallHierarchy',
  'incomingCalls',
  'outgoingCalls',
  'listDiagnostics',
]

/** 解析 /lsp 命令参数 → { op, filePath?, line?, character? } */
export function parseLspArgs(args: string[]): {
  op: LspOperation
  filePath?: string
  line: number
  character: number
  error?: string
} {
  const op = args[0]?.trim() as LspOperation | undefined
  if (!op || !LSP_OPERATIONS.includes(op)) {
    return {
      op: 'listDiagnostics',
      line: 1,
      character: 1,
      error: `未知 LSP 操作: ${op ?? '(空)'}。可用: ${LSP_OPERATIONS.join(', ')}`,
    }
  }
  const filePath = args[1]
  const line = args[2] ? Math.max(1, parseInt(args[2], 10) || 1) : 1
  const character = args[3] ? Math.max(1, parseInt(args[3], 10) || 1) : 1
  return { op, filePath, line, character }
}

/** 把 1-based 位置转成 0-based LSP 位置 */
function position(filePath: string, line: number, character: number) {
  return {
    textDocument: { uri: pathToFileURL(path.resolve(filePath)).href },
    position: { line: line - 1, character: character - 1 },
  }
}

/** 执行一次 LSP 操作，返回文本结果 */
export async function executeLsp(
  op: LspOperation,
  filePath?: string,
  line?: number,
  character?: number,
): Promise<{ success: boolean; output: string; error?: string }> {
  if (!isLspConnected()) {
    const error = 'LSP 未连接：请先在主进程初始化 LSP 并配置服务器'
    return { success: false, error, output: error }
  }
  const manager = getLspServerManager()
  if (!manager) {
    const error = 'LSP 服务器管理器不可用'
    return { success: false, error, output: error }
  }

  try {
    // listDiagnostics：只读本地诊断注册表，不访问文件/LSP 服务器
    if (op === 'listDiagnostics') {
      const reg = checkForLSPDiagnostics()
      return {
        success: true,
        output: formatDiagnosticsText(reg.flatMap(r => r.files), filePath),
      }
    }

    if (!filePath) {
      const error = `操作 ${op} 需要文件路径`
      return { success: false, error, output: error }
    }

    const ln = line ?? 1
    const col = character ?? 1

    // workspaceSymbol 不需要特定行号
    if (op === 'workspaceSymbol') {
      const result = await manager.sendRequest<unknown>(
        filePath,
        'workspace/symbol',
        { query: '' },
      )
      return {
        success: true,
        output: `workspaceSymbol: ${JSON.stringify(result)}\n符号数: ${Array.isArray(result) ? result.length : 0}`,
      }
    }

    // goToImplementation / incomingCalls / outgoingCalls 需要 prepareCallHierarchy 两步
    const method = methodFor(op)
    if (op === 'incomingCalls' || op === 'outgoingCalls') {
      const items = await manager.sendRequest<Array<{ uri: string }>>(
        filePath,
        'textDocument/prepareCallHierarchy',
        position(filePath, ln, col),
      )
      if (!items || items.length === 0) {
        return { success: true, output: '在此位置未找到调用层次项' }
      }
      const follow = op === 'incomingCalls' ? 'callHierarchy/incomingCalls' : 'callHierarchy/outgoingCalls'
      const calls = await manager.sendRequest<unknown>(filePath, follow, { item: items[0] })
      return { success: true, output: `${op}: ${JSON.stringify(calls)}` }
    }

    const params =
      method === 'textDocument/documentSymbol'
        ? { textDocument: { uri: pathToFileURL(path.resolve(filePath)).href } }
        : position(filePath, ln, col)

    const result = await manager.sendRequest<unknown>(filePath, method, params)
    return {
      success: true,
      output: `${op} (${filePath}:${line}:${col}):\n${JSON.stringify(result, null, 2)}`,
    }
  } catch (error) {
    errLog(`LSP ${op} 失败: ${(error as Error).message}`)
    const message = `执行 ${op} 失败: ${(error as Error).message}`
    return { success: false, error: message, output: message }
  }
}

/** 检查 LSP 是否连接（供外部判断） */
export function lspConnected(): boolean {
  return isLspConnected()
}

/** 操作 → JSON-RPC 方法名 */
function methodFor(op: LspOperation): string {
  switch (op) {
    case 'goToDefinition': return 'textDocument/definition'
    case 'findReferences': return 'textDocument/references'
    case 'hover': return 'textDocument/hover'
    case 'documentSymbol': return 'textDocument/documentSymbol'
    case 'goToImplementation': return 'textDocument/implementation'
    case 'prepareCallHierarchy': return 'textDocument/prepareCallHierarchy'
    case 'workspaceSymbol': return 'workspace/symbol'
    default: return 'textDocument/hover'
  }
}

/** 把诊断注册表结果格式化为文本（供 listDiagnostics 返回） */
function formatDiagnosticsText(files: DiagnosticFile[], filterPath?: string): string {
  if (files.length === 0) return '当前没有可用的 LSP 诊断信息。'
  const lines: string[] = []
  let total = 0
  for (const file of files) {
    if (filterPath && !file.uri.endsWith(filterPath)) continue
    lines.push(`${file.uri}:`)
    for (const d of file.diagnostics) {
      const sev = d.severity === 'Error' ? '❌' : d.severity === 'Warning' ? '⚠️' : 'ℹ️'
      const pos = (d.range as any)?.start ? `行 ${(d.range as any).start.line + 1}:${(d.range as any).start.character + 1}` : ''
      const codeStr = d.code ? ` [${d.code}]` : ''
      lines.push(`  ${sev} [${pos}] ${d.message}${codeStr}`)
      total++
    }
  }
  return total === 0 && filterPath
    ? `没有匹配 ${filterPath} 的诊断。`
    : lines.join('\n') + `\n\n共 ${total} 条诊断`
}

// 默认导出命令构造函数供 registry 注册时引用（可选）
export const LSP_TOOL_NAME = 'lsp'