/**
 * src/main/lsp/LSPDiagnosticRegistry.ts — LSP 诊断注册表（移植自 D:\src\services\lsp\LSPDiagnosticRegistry.ts）
 *
 * 存储从 LSP 服务器异步收到的 textDocument/publishDiagnostics 诊断，跨轮去重、
 * 按严重度排序、限量截断，供上层取用。
 *
 * 适配（相对原文）：
 *   - lru-cache 第三方包 → 内置简单 LRU（键容量上限 500，够用，避免新增依赖）
 *   - DiagnosticFile 类型（原文来自 Claude Code diagnosticTracking）→ K 本地定义在此
 *   - jsonStringify（slowOperations）→ JSON.stringify
 *   - 日志 → logManager
 */
import { randomUUID } from 'node:crypto'
import { logManager } from '../logger/manager'

function debug(m: string): void {
  logManager?.log('debug', m)
}
function errLog(m: string): void {
  logManager?.log('error', m)
}

/** 单个诊断条目 */
export interface LSPDiagnostic {
  message: string
  severity?: string
  range?: unknown
  source?: string
  code?: unknown
}

/** 一个文件的诊断集合 */
export interface DiagnosticFile {
  uri: string
  diagnostics: LSPDiagnostic[]
}

export type PendingLSPDiagnostic = {
  serverName: string
  files: DiagnosticFile[]
  timestamp: number
  attachmentSent: boolean
}

// 容量限制
const MAX_DIAGNOSTICS_PER_FILE = 10
const MAX_TOTAL_DIAGNOSTICS = 30
const MAX_DELIVERED_FILES = 500

// --- 极简 LRU（键容量上限，LRU 淘汰）---
class LruMap<V> {
  private map = new Map<string, V>()
  constructor(private max: number) {}
  get(key: string): V | undefined {
    const v = this.map.get(key)
    if (v === undefined) return undefined
    // 刷新为最新（LRU 语义）
    this.map.delete(key)
    this.map.set(key, v)
    return v
  }
  has(key: string): boolean {
    return this.map.has(key)
  }
  set(key: string, value: V): void {
    this.map.delete(key)
    this.map.set(key, value)
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) this.map.delete(oldest)
    }
  }
  delete(key: string): void {
    this.map.delete(key)
  }
  clear(): void {
    this.map.clear()
  }
  get size(): number {
    return this.map.size
  }
}

const pendingDiagnostics = new Map<string, PendingLSPDiagnostic>()
const deliveredDiagnostics = new LruMap<Set<string>>(MAX_DELIVERED_FILES)

/** 注册服务器推送的诊断 */
export function registerPendingLSPDiagnostic({
  serverName,
  files,
}: { serverName: string; files: DiagnosticFile[] }): void {
  const diagnosticId = randomUUID()
  debug(`LSP Diagnostics: Registering ${files.length} diagnostic file(s) from ${serverName} (ID: ${diagnosticId})`)
  pendingDiagnostics.set(diagnosticId, {
    serverName,
    files,
    timestamp: Date.now(),
    attachmentSent: false,
  })
}

function severityToNumber(severity: string | undefined): number {
  switch (severity) {
    case 'Error': return 1
    case 'Warning': return 2
    case 'Info': return 3
    default: return 4
  }
}

function createDiagnosticKey(diag: LSPDiagnostic): string {
  return JSON.stringify({
    message: diag.message,
    severity: diag.severity,
    range: diag.range,
    source: diag.source || null,
    code: diag.code || null,
  })
}

function deduplicateDiagnosticFiles(allFiles: DiagnosticFile[]): DiagnosticFile[] {
  const fileMap = new Map<string, Set<string>>()
  const dedupedFiles: DiagnosticFile[] = []
  for (const file of allFiles) {
    if (!fileMap.has(file.uri)) {
      fileMap.set(file.uri, new Set())
      dedupedFiles.push({ uri: file.uri, diagnostics: [] })
    }
    const seenDiagnostics = fileMap.get(file.uri)!
    const dedupedFile = dedupedFiles.find(f => f.uri === file.uri)!
    const previouslyDelivered = deliveredDiagnostics.get(file.uri) || new Set<string>()
    for (const diag of file.diagnostics) {
      try {
        const key = createDiagnosticKey(diag)
        if (seenDiagnostics.has(key) || previouslyDelivered.has(key)) continue
        seenDiagnostics.add(key)
        dedupedFile.diagnostics.push(diag)
      } catch {
        dedupedFile.diagnostics.push(diag)
      }
    }
  }
  return dedupedFiles.filter(f => f.diagnostics.length > 0)
}

/** 取回待交付的 LSP 诊断（去重 + 限量） */
export function checkForLSPDiagnostics(): Array<{ serverName: string; files: DiagnosticFile[] }> {
  debug(`LSP 诊断: 检查注册表 - ${pendingDiagnostics.size} 条待处理`)
  const allFiles: DiagnosticFile[] = []
  const serverNames = new Set<string>()
  const diagnosticsToMark: PendingLSPDiagnostic[] = []

  for (const diagnostic of pendingDiagnostics.values()) {
    if (!diagnostic.attachmentSent) {
      allFiles.push(...diagnostic.files)
      serverNames.add(diagnostic.serverName)
      diagnosticsToMark.push(diagnostic)
    }
  }
  if (allFiles.length === 0) return []

  let dedupedFiles: DiagnosticFile[]
  try {
    dedupedFiles = deduplicateDiagnosticFiles(allFiles)
  } catch {
    dedupedFiles = allFiles
  }

  for (const diagnostic of diagnosticsToMark) diagnostic.attachmentSent = true
  for (const [id, diagnostic] of pendingDiagnostics) {
    if (diagnostic.attachmentSent) pendingDiagnostics.delete(id)
  }

  let totalDiagnostics = 0
  let truncatedCount = 0
  for (const file of dedupedFiles) {
    file.diagnostics.sort((a, b) => severityToNumber(a.severity) - severityToNumber(b.severity))
    if (file.diagnostics.length > MAX_DIAGNOSTICS_PER_FILE) {
      truncatedCount += file.diagnostics.length - MAX_DIAGNOSTICS_PER_FILE
      file.diagnostics = file.diagnostics.slice(0, MAX_DIAGNOSTICS_PER_FILE)
    }
    const remainingCapacity = MAX_TOTAL_DIAGNOSTICS - totalDiagnostics
    if (file.diagnostics.length > remainingCapacity) {
      truncatedCount += file.diagnostics.length - remainingCapacity
      file.diagnostics = file.diagnostics.slice(0, remainingCapacity)
    }
    totalDiagnostics += file.diagnostics.length
  }
  dedupedFiles = dedupedFiles.filter(f => f.diagnostics.length > 0)

  if (truncatedCount > 0) {
    debug(`LSP Diagnostics: Volume limiting removed ${truncatedCount} diagnostic(s)`)
  }

  for (const file of dedupedFiles) {
    if (!deliveredDiagnostics.has(file.uri)) deliveredDiagnostics.set(file.uri, new Set())
    const delivered = deliveredDiagnostics.get(file.uri)!
    for (const diag of file.diagnostics) {
      try {
        delivered.add(createDiagnosticKey(diag))
      } catch {
        // 忽略跟踪失败，不阻塞交付
      }
    }
  }

  const finalCount = dedupedFiles.reduce((sum, f) => sum + f.diagnostics.length, 0)
  if (finalCount === 0) return []
  return [{ serverName: Array.from(serverNames).join(', '), files: dedupedFiles }]
}

export function clearAllLSPDiagnostics(): void {
  pendingDiagnostics.clear()
}
export function resetAllLSPDiagnosticState(): void {
  pendingDiagnostics.clear()
  deliveredDiagnostics.clear()
}
export function clearDeliveredDiagnosticsForFile(fileUri: string): void {
  deliveredDiagnostics.delete(fileUri)
}
export function getPendingLSPDiagnosticCount(): number {
  return pendingDiagnostics.size
}