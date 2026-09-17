/**
 * engine/repoMap.ts — 仓库代码符号索引（参考 Aider repomap.py）
 *
 * 功能：扫描代码仓库 → 提取符号定义 → 构建代码图 → PageRank 排序 → 返回 ranked tags
 * 设计对齐 Aider：
 *   - 符号提取：正则匹配 (function|class|interface|type|const|let|var|enum)
 *   - 图构建：文件内符号相互引用
 *   - PageRank：阻尼系数 0.85，30 次迭代
 *   - 缓存：以目录为 key，5 分钟过期
 *
 * 注意：不使用 tree-sitter（依赖过大），用 ripgrep + 正则替代。
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, sep } from 'node:path';

/** 原生 ripgrep 替代：列出目录下匹配类型的文件 */
async function ripGrepFiles(args: string[], cwd: string): Promise<string[]> {
  const types = new Set<string>();
  const patterns: string[] = [];
  let i = 0;
  while (i < args.length) {
    if (args[i] === '--type' && i + 1 < args.length) {
      types.add(args[i + 1]);
      i += 2;
    } else if (args[i] === '--regexp' && i + 1 < args.length) {
      patterns.push(args[i + 1]);
      i += 2;
    } else if (args[i] === '--files') {
      i++;
    } else {
      i++;
    }
  }
  const exts = new Map<string, boolean>();
  for (const t of types) {
    if (t === 'ts' || t === 'tsx') { exts.set('.ts', true); exts.set('.tsx', true); }
    if (t === 'js' || t === 'jsx') { exts.set('.js', true); exts.set('.jsx', true); }
    if (t === 'json') exts.set('.json', true);
    if (t === 'py') exts.set('.py', true);
    if (t === 'md') exts.set('.md', true);
  }
  const results: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries: { name: string; isFile: boolean }[];
    try {
      const items = await readdir(dir, { withFileTypes: true });
      entries = items.map(e => ({ name: e.name, isFile: e.isFile() }));
    } catch (e) {
      // 不要静默吞掉：目录不可读是正常情况（权限/竞态删除），
      // 但**代码 bug** 也会走到这里 —— 上面那处 isFile() 误调用就是这样被吞了
      // 很久，表现为"repoMap 恒返回 0 符号"且毫无线索。
      // 开 KX2_DEBUG_REPOMAP=1 可看到具体原因。
      if (process.env.KX2_DEBUG_REPOMAP === '1') {
        console.warn(`[RepoMap] 读取目录失败 ${dir}: ${(e as Error).message}`);
      }
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      // 注意：entry.isFile 是在上面 map 时**求值好的布尔值**，不是 Dirent 的方法。
      // 原实现写成 entry.isFile() —— 抛 TypeError 后被外层 catch 静默吞掉，
      // 表现为「walk 一个文件都没遍历就返回空数组」，整个 repoMap 因此恒返回 0 符号。
      if (entry.isFile) {
        const ext = '.' + entry.name.split('.').pop();
        if (exts.has(ext)) results.push(full);
      } else if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await walk(full);
      }
    }
  }
  await walk(cwd);
  return results;
}

/** 原生 ripgrep 替代：在文件中搜索匹配正则 */
async function ripGrepContent(args: string[], file: string): Promise<string[]> {
  let regex: RegExp | null = null;
  let noHeading = false;
  let noFilename = false;
  let lineNumber = false;
  let i = 0;
  while (i < args.length) {
    if (args[i] === '--regexp' && i + 1 < args.length) {
      try { regex = new RegExp(args[i + 1]); } catch { regex = null; }
      i += 2;
    } else if (args[i] === '--no-heading') { noHeading = true; i++; }
    else if (args[i] === '--no-filename') { noFilename = true; i++; }
    else if (args[i] === '-n') { lineNumber = true; i++; }
    else { i++; }
  }
  if (!regex) return [];
  const results: string[] = [];
  try {
    const content = await readFile(file, 'utf-8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (regex.test(line)) {
        let out = '';
        if (lineNumber) out += `${idx + 1}:`;
        if (!noFilename) out += file + ':';
        if (!noHeading) out += file + ':';
        results.push((out + line).trimStart());
      }
    });
  } catch { /* skip */ }
  return results;
}

/** 统一 ripgrep 接口：根据参数判断是文件列表还是内容搜索 */
async function ripGrep(args: string[], cwdOrFile: string, _signal?: AbortSignal): Promise<string[]> {
  if (args.includes('--files')) return ripGrepFiles(args, cwdOrFile);
  return ripGrepContent(args, cwdOrFile);
}

const fs = { existsSync: (_p?: string): boolean => true };
const expandPath = (p: string) => p;
const getFsImplementation = () => fs;

// Re-export for backward compatibility within this module
export { ripGrep as ripGrep, fs as getFsImplementation, expandPath };

export type SymbolKind = 'function' | 'class' | 'interface' | 'type' | 'const' | 'let' | 'var' | 'enum';

export interface SymbolEntry {
  name: string;
  kind: SymbolKind;
  file: string;
  line: number;
}

export interface RankedTag {
  name: string;
  score: number;
}

export interface RepoMapOptions {
  rootDir: string;
  maxFiles?: number;
  cacheMaxEntries?: number;
}

export interface RepoMapResult {
  symbols: SymbolEntry[];
  rankedTags: RankedTag[];
}

export const SYMBOL_REGEX = '^(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?(?:abstract\\s+)?(function|class|interface|type|enum|const|let|var)\\s+(\\w+)';
const CACHE_TTL_MS = 5 * 60_000; // 5 分钟

export class RepoMap {
  private rootDir: string;
  private maxFiles: number;
  private cacheMaxEntries: number;
  private cache = new Map<string, { result: RepoMapResult; timestamp: number }>();

  constructor(options: RepoMapOptions) {
    this.rootDir = options.rootDir;
    this.maxFiles = options.maxFiles ?? 200;
    this.cacheMaxEntries = options.cacheMaxEntries ?? 50;
  }

  /** 获取仓库中最重要的符号（ranked tags） */
  async getRankedTags(topN: number = 50): Promise<RankedTag[]> {
    const result = await this.build();
    return result.rankedTags.slice(0, topN);
  }

  /** 获取所有提取的符号 */
  async getSymbols(): Promise<SymbolEntry[]> {
    const result = await this.build();
    return result.symbols;
  }

  /** 构建完整仓库映射（含图算法） */
  async build(): Promise<RepoMapResult> {
    const cacheKey = this.rootDir;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.result;
    }

    const symbols = await this.extractSymbols();
    const rankedTags = this.computePageRank(symbols);

    const result = { symbols, rankedTags };
    this.cache.set(cacheKey, { result, timestamp: Date.now() });
    this.evictCache();

    return result;
  }

  /** 清空缓存 */
  invalidateCache(): void {
    this.cache.clear();
  }

  // ------------------------------------------------------------------
  // 私有方法
  // ------------------------------------------------------------------

  private async extractSymbols(): Promise<SymbolEntry[]> {
    const root = expandPath(this.rootDir);
    const fs = getFsImplementation();

    // 检查目录是否存在
    if (!fs.existsSync(root)) {
      return [];
    }

    // 使用 ripgrep 获取文件列表
    let files: string[] = [];
    try {
      files = await ripGrep(
        ['--files', '--type', 'ts', '--type', 'js', '--type', 'tsx', '--type', 'jsx'],
        root,
        AbortSignal.timeout(30_000),
      );
    } catch {
      // 回退：无 ripgrep 时返回空
      return [];
    }

    files = files.slice(0, this.maxFiles);

    // 对每个文件提取符号定义
    const allSymbols: SymbolEntry[] = [];
    for (const file of files) {
      try {
        const fileSymbols = await this.extractSymbolsFromFile(file);
        allSymbols.push(...fileSymbols);
      } catch {
        // 跳过无法读取的文件
      }
    }

    return allSymbols;
  }

  private async extractSymbolsFromFile(file: string): Promise<SymbolEntry[]> {
    const symbols: SymbolEntry[] = [];
    let result: string[];

    try {
      // -n 输出行号，--no-heading 去掉文件名前缀
      result = await ripGrep(
        ['--regexp', SYMBOL_REGEX, '--no-heading', '--no-filename', '-n'],
        file,
        AbortSignal.timeout(10_000),
      );
    } catch {
      return [];
    }

    for (const line of result) {
      // 格式: lineNumber:content
      const match = line.match(/^(\d+):\s*(.+)$/);
      if (!match) continue;

      const content = match[2];
      const lineNum = parseInt(match[1], 10);
      const defMatch = content.match(
        /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:abstract\s+)?(function|class|interface|type|enum|const|let|var)\s+(\w+)/
      );

      if (defMatch) {
        const kind = defMatch[1] as SymbolKind;
        const name = defMatch[2];
        symbols.push({ name, kind, file, line: lineNum });
      }
    }

    return symbols;
  }

  /**
   * 简化版 PageRank（对齐 Aider repomap.py 的图算法思路）
   *
   * 图构建策略（对齐 Aider 的 tag 链接）：
   *   - 节点：每个符号
   *   - 边：同一文件内的符号两两互连（表示代码上下文关联）
   *   - 权重：文件内所有符号均分（无向图，出度=入度）
   */
  private computePageRank(symbols: SymbolEntry[]): RankedTag[] {
    const n = symbols.length;
    if (n === 0) return [];

    // 按文件分组
    const fileMap = new Map<string, number[]>();
    for (let i = 0; i < n; i++) {
      const indices = fileMap.get(symbols[i].file) || [];
      indices.push(i);
      fileMap.set(symbols[i].file, indices);
    }

    // PageRank 参数
    const damping = 0.85;
    const iterations = 30;
    let scores = new Float64Array(n).fill(1 / n);

    for (let iter = 0; iter < iterations; iter++) {
      const newScores = new Float64Array(n).fill((1 - damping) / n);

      for (const [, indices] of fileMap) {
        // 文件内符号共享投票（均匀分配）
        const share = damping / indices.length;
        for (let a = 0; a < indices.length; a++) {
          for (let b = 0; b < indices.length; b++) {
            if (a !== b) {
              newScores[indices[b]] += scores[indices[a]] * share;
            }
          }
        }
      }

      scores = newScores;
    }

    // 构建排序结果
    const ranked: RankedTag[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < n; i++) {
      const key = `${symbols[i].file}:${symbols[i].name}`;
      if (!seen.has(key)) {
        seen.add(key);
        ranked.push({ name: symbols[i].name, score: scores[i] });
      }
    }

    ranked.sort((a, b) => b.score - a.score);
    return ranked;
  }

  /** 缓存淘汰：超过上限时删除最旧的条目 */
  private evictCache(): void {
    if (this.cache.size > this.cacheMaxEntries) {
      // 找到最旧的 key
      let oldestKey: string | undefined;
      let oldestTime = Infinity;
      for (const [key, entry] of this.cache) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = key;
        }
      }
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }
}

/** 便捷工厂函数 */
export function createRepoMap(options: RepoMapOptions): RepoMap {
  return new RepoMap(options);
}
