/**
 * engine/codeVectorStore.ts — 代码库向量存储与语义搜索（SQLite FTS5）
 *
 * ⚠️ **当前不可用（未完成移植）**
 *
 * 本模块导入 `../utils/ripgrep.js` / `../utils/fsOperations.js` / `../utils/path.js`
 * 三个**本项目中不存在**的模块。`repoMap.ts` 内部只提供了残缺的本地桩
 * （`const fs = { existsSync: () => true }`），而本模块需要的
 * `fs.readFile` / `fs.stat` 都没有 —— 一旦调用 `index()` 就会崩。
 *
 * 它目前**零引用**（无任何生产代码或测试使用）。
 *
 * 要真正启用它，需要先实现那三个工具模块（或改用 `node:fs/promises` 直接实现），
 * 属**新功能开发**而非类型修复，故此处仅标注状态、不改逻辑。
 *
 * ─────────────────────────────────────────────────────────────
 * 功能：使用 SQLite FTS5 提供代码库全文搜索 + BM25 排序
 * 设计对齐 Goose DuckDB 向量存储思路，但使用 bun:sqlite（零原生依赖）：
 *   - 文件内容索引：FTS5 全文搜索 + BM25 相关性排序
 *   - 符号索引：函数/类/接口定义的位置与上下文
 *   - 增量索引：仅索引新/修改的文件
 *   - 缓存：以目录为 key，5 分钟过期（与 repoMap 一致）
 *
 * 技术栈：
 *   - SQLite FTS5：全文搜索 + BM25 排序（无需外部 embedding 服务）
 *   - ripgrep：文件发现（复用 repoMap 的 ripGrep 工具）
 *   - 正则：符号提取（复用 repoMap 的 SYMBOL_REGEX）
 */

import { SYMBOL_REGEX, type SymbolKind, type SymbolEntry, ripGrep, getFsImplementation, expandPath } from './repoMap.ts'

// ============================================================================
// Types
// ============================================================================

export interface CodeFileEntry {
  path: string
  relativePath: string
  language: string
  size: number
  modifiedAt: number
}

export interface SearchResult {
  file: string
  line: number
  column: number
  snippet: string
  score: number
  kind: SymbolKind | 'content'
}

export interface VectorStoreOptions {
  rootDir: string
  cacheMaxEntries?: number
  maxFileSize?: number
  includePatterns?: string[]
  excludePatterns?: string[]
}

// ============================================================================
// CodeVectorStore
// ============================================================================

export class CodeVectorStore {
  private rootDir: string
  private cacheMaxEntries: number
  private maxFileSize: number
  private includePatterns: string[]
  private excludePatterns: string[]
  private db: any // SQLite Database from bun:sqlite
  private cache = new Map<string, { result: SearchResult[]; timestamp: number }>()
  private indexedFiles = new Set<string>()

  constructor(options: VectorStoreOptions) {
    this.rootDir = expandPath(options.rootDir)
    this.cacheMaxEntries = options.cacheMaxEntries ?? 50
    this.maxFileSize = options.maxFileSize ?? 500_000 // 500KB
    this.includePatterns = options.includePatterns ?? [
      '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
      '**/*.py', '**/*.go', '**/*.rs', '**/*.java',
      '**/*.c', '**/*.cpp', '**/*.h', '**/*.hpp',
      '**/*.rb', '**/*.php', '**/*.swift', '**/*.kt',
    ]
    this.excludePatterns = options.excludePatterns ?? [
      '**/node_modules/**', '**/.git/**', '**/dist/**',
      '**/build/**', '**/vendor/**', '**/*.min.js',
      '**/*.d.ts', '**/desktop-electron/**',
    ]
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  private ensureDb(): void {
    if (this.db) return

    try {
      // ⚠️ `bun:sqlite` 是 Bun 运行时专有模块，Node/Electron 下**不存在**：
      //   - 无法解析该模块名；
      //   - ESM 产物里连 require 本身都没有。
      // 因此下面的 require 必然抛错，被 catch 捕获后 this.db 恒为 null，
      // 表现为「索引/搜索静默不可用」。
      //
      // 要真正启用本模块，需把存储层换成 Node 侧实现（better-sqlite3 / node:sqlite），
      // 属新功能开发，不在类型修复范围内 —— 故此处保持原逻辑，仅让失败可诊断。
      const { Database } = require('bun:sqlite') as { Database: new (path: string) => unknown }
      this.db = new Database(':memory:')

      // Main content FTS5 table
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS code_fts USING fts5(
          path,
          content,
          tokenize = 'porter unicode61'
        )
      `)

      // Symbols metadata table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS code_symbols (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          path TEXT NOT NULL,
          line INTEGER NOT NULL,
          column INTEGER NOT NULL,
          name TEXT NOT NULL,
          kind TEXT NOT NULL,
          context TEXT
        )
      `)

      // Create index on symbols
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_symbols_path ON code_symbols(path)
      `)

      // Files metadata table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS code_files (
          path TEXT PRIMARY KEY,
          relative_path TEXT NOT NULL,
          language TEXT,
          size INTEGER,
          modified_at REAL,
          indexed_at REAL
        )
      `)
    } catch {
      throw new Error(
        'SQLite (bun:sqlite) is not available. This feature requires Bun runtime.',
      )
    }
  }

  // ============================================================================
  // Indexing
  // ============================================================================

  async index(): Promise<{ filesIndexed: number; symbolsIndexed: number }> {
    this.ensureDb()

    const fs = getFsImplementation()
    const files = await this.discoverFiles(fs)

    let filesIndexed = 0
    let symbolsIndexed = 0

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8').catch(() => null)
      if (!content) continue

      const relativePath = file.replace(this.rootDir, '').replace(/^[/\\]/, '')

      // Skip if already indexed and not modified
      const stat = await fs.stat(file).catch(() => null)
      if (!stat) continue

      const modifiedAt = stat.mtimeMs ?? Date.now()
      if (this.indexedFiles.has(file)) {
        const existing = this.db.prepare('SELECT modified_at FROM code_files WHERE path = ?').get(file)
        if (existing && (existing as any).modified_at >= modifiedAt) {
          continue // Already up to date
        }
      }

      // Index file content in FTS5
      const lineCount = content.split('\n').length
      const truncated = content.length > this.maxFileSize
        ? content.slice(0, this.maxFileSize) + '\n... [truncated]'
        : content

      // Delete old entry if exists
      this.db.prepare('DELETE FROM code_fts WHERE path = ?').run(file)
      this.db.prepare('DELETE FROM code_symbols WHERE path = ?').run(file)

      // Insert into FTS5
      this.db.prepare(
        'INSERT INTO code_fts (path, content) VALUES (?, ?)',
      ).run(file, truncated)

      // Extract and index symbols
      const symbols = this.extractSymbols(content, relativePath)
      for (const sym of symbols) {
        this.db.prepare(
          `INSERT INTO code_symbols (path, line, column, name, kind, context)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(file, sym.line, sym.column, sym.name, sym.kind, sym.context)
        symbolsIndexed++
      }

      // Update files metadata
      this.db.prepare(
        `INSERT OR REPLACE INTO code_files (path, relative_path, language, size, modified_at, indexed_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(file, relativePath, this.detectLanguage(relativePath), content.length, modifiedAt, Date.now())

      this.indexedFiles.add(file)
      filesIndexed++
    }

    return { filesIndexed, symbolsIndexed }
  }

  async indexFile(filePath: string): Promise<void> {
    this.ensureDb()
    const fs = getFsImplementation()

    const content = await fs.readFile(filePath, 'utf-8').catch(() => null)
    if (!content) return

    const relativePath = filePath.replace(this.rootDir, '').replace(/^[/\\]/, '')
    const stat = await fs.stat(filePath).catch(() => null)
    if (!stat) return

    const modifiedAt = stat.mtimeMs ?? Date.now()

    this.db.prepare('DELETE FROM code_fts WHERE path = ?').run(filePath)
    this.db.prepare('DELETE FROM code_symbols WHERE path = ?').run(filePath)

    const truncated = content.length > this.maxFileSize
      ? content.slice(0, this.maxFileSize) + '\n... [truncated]'
      : content

    this.db.prepare('INSERT INTO code_fts (path, content) VALUES (?, ?)').run(filePath, truncated)

    const symbols = this.extractSymbols(content, relativePath)
    for (const sym of symbols) {
      this.db.prepare(
        `INSERT INTO code_symbols (path, line, column, name, kind, context) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(filePath, sym.line, sym.column, sym.name, sym.kind, sym.context)
    }

    this.db.prepare(
      `INSERT OR REPLACE INTO code_files (path, relative_path, language, size, modified_at, indexed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(filePath, relativePath, this.detectLanguage(relativePath), content.length, modifiedAt, Date.now())

    this.indexedFiles.add(filePath)
  }

  // ============================================================================
  // Search
  // ============================================================================

  async search(query: string, topK: number = 10): Promise<SearchResult[]> {
    this.ensureDb()

    const cacheKey = `${query}:${topK}`
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < 5 * 60_000) {
      return cached.result
    }

    // Use FTS5 BM25 ranking for content search
    const contentResults = this.db.prepare(
      `SELECT path, rank, snippet(code_fts, 1, '>>>', '<<<', '...', 10) as snippet
       FROM code_fts
       WHERE code_fts MATCH ?
       ORDER BY bm25(code_fts)
       LIMIT ?`,
    ).all(query, topK) as any[]

    const results: SearchResult[] = contentResults.map((row: any) => {
      const snippet = this.cleanSnippet(row.snippet)
      const lineNum = this.extractLineFromSnippet(snippet)
      return {
        file: row.path,
        line: lineNum,
        column: 0,
        snippet,
        score: -row.rank, // BM25: lower rank = higher relevance
        kind: 'content' as const,
      }
    })

    // Also search symbols by name
    const symbolResults = this.db.prepare(
      `SELECT path, line, column, name, kind, context FROM code_symbols
       WHERE name LIKE ? OR kind LIKE ?
       LIMIT ?`,
    ).all(`%${query}%`, `%${query}%`, topK) as any[]

    for (const row of symbolResults) {
      const snippet = row.context || `${row.kind} ${row.name}`
      results.push({
        file: row.path,
        line: row.line,
        column: row.column,
        snippet,
        score: 0.8, // Symbol matches get a good score
        kind: row.kind as SymbolKind,
      })
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score)

    // Cache results
    this.cache.set(cacheKey, { result: results.slice(0, topK), timestamp: Date.now() })
    if (this.cache.size > this.cacheMaxEntries) {
      const oldest = [...this.cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0]
      if (oldest) this.cache.delete(oldest[0])
    }

    return results.slice(0, topK)
  }

  async searchSymbol(name: string, kind?: string): Promise<SearchResult[]> {
    this.ensureDb()

    let query = 'SELECT path, line, column, name, kind, context FROM code_symbols WHERE name LIKE ?'
    const params: (string | number)[] = [`%${name}%`]

    if (kind) {
      query += ' AND kind = ?'
      params.push(kind)
    }

    query += ' ORDER BY line LIMIT 20'

    const rows = this.db.prepare(query).all(...params) as any[]
    return rows.map((row: any) => ({
      file: row.path,
      line: row.line,
      column: row.column,
      snippet: row.context || `${row.kind} ${row.name}`,
      score: 1.0,
      kind: row.kind as SymbolKind,
    }))
  }

  getStats(): { filesIndexed: number; symbolsIndexed: number; cacheSize: number } {
    this.ensureDb()

    let filesIndexed = 0
    let symbolsIndexed = 0

    try {
      const fileCount = this.db.prepare('SELECT COUNT(*) as cnt FROM code_files').get() as any
      filesIndexed = fileCount?.cnt ?? 0

      const symCount = this.db.prepare('SELECT COUNT(*) as cnt FROM code_symbols').get() as any
      symbolsIndexed = symCount?.cnt ?? 0
    } catch {
      // Tables may not exist yet
    }

    return {
      filesIndexed,
      symbolsIndexed,
      cacheSize: this.cache.size,
    }
  }

  clearCache(): void {
    this.cache.clear()
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private async discoverFiles(fs: ReturnType<typeof getFsImplementation>): Promise<string[]> {
    const allFiles: string[] = []

    for (const pattern of this.includePatterns) {
      try {
        const matches = await ripGrep(['--files', '--glob', pattern], this.rootDir)

        for (const match of matches) {
          const fullPath = match.startsWith(this.rootDir)
            ? match
            : `${this.rootDir}/${match}`

          // Check exclusions
          const relPath = fullPath.replace(this.rootDir, '').replace(/^[/\\]/, '')
          const excluded = this.excludePatterns.some(exc => this.matchGlob(relPath, exc))
          if (!excluded) {
            // 文件大小在索引阶段统一检查（此处不再预取 stat）
            allFiles.push(fullPath)
          }
        }
      } catch {
        // Skip patterns that don't match
      }
    }

    // Deduplicate
    return [...new Set(allFiles)]
  }

  private extractSymbols(content: string, filePath: string): Array<{
    name: string
    kind: SymbolKind
    line: number
    column: number
    context: string
  }> {
    const symbols: Array<{
      name: string
      kind: SymbolKind
      line: number
      column: number
      context: string
    }> = []

    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(SYMBOL_REGEX)
      if (match) {
        const kind = match[1] as SymbolKind
        const name = match[2]
        const column = match.index ?? 0

        // Get context (surrounding lines)
        const start = Math.max(0, i - 1)
        const end = Math.min(lines.length, i + 3)
        const context = lines.slice(start, end).join('\n').slice(0, 200)

        symbols.push({ name, kind, line: i + 1, column, context })
      }
    }

    return symbols
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
    const langMap: Record<string, string> = {
      ts: 'TypeScript', tsx: 'TypeScript React', js: 'JavaScript', jsx: 'JavaScript React',
      py: 'Python', go: 'Go', rs: 'Rust', java: 'Java', c: 'C', cpp: 'C++',
      rb: 'Ruby', php: 'PHP', swift: 'Swift', kt: 'Kotlin',
    }
    return langMap[ext] ?? ext
  }

  private matchGlob(path: string, pattern: string): boolean {
    // Simple glob matching
    const regexStr = pattern
      .replace(/\*\*/g, '{{DOUBLESTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{DOUBLESTAR}}/g, '.*')

    return new RegExp(`^${regexStr}$`).test(path)
  }

  private cleanSnippet(snippet: string): string {
    return snippet
      .replace(/>>>/g, '')
      .replace(/<<</g, '')
      .replace(/\.\.\./g, '')
      .trim()
  }

  private extractLineFromSnippet(snippet: string): number {
    // Try to find line number in the snippet context
    return 1
  }
}
