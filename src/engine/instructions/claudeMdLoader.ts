/**
 * engine/instructions/claudeMdLoader.ts — 项目指令文件加载
 *
 * 移植自 D:\src\utils\claudemd.ts 的核心机制。
 *
 * ─────────────────────────────────────────────────────────────
 * 为什么需要它
 * ─────────────────────────────────────────────────────────────
 * KX2API 此前只有 `/init` 命令**生成** CLAUDE.md，却没有任何**读取**端 ——
 * 项目里写好的约定、构建命令、目录说明，模型完全看不到。
 * 等于用户辛苦写的项目指令被丢在地上。
 *
 * ─────────────────────────────────────────────────────────────
 * 设计要点（三条都来自实践中踩过的坑）
 * ─────────────────────────────────────────────────────────────
 * 1. **逐级向上查找**：从工作目录一直找到盘根，每层的 CLAUDE.md 都收集。
 *    这样在子目录里工作时，父目录的约定依然生效。
 * 2. **优先级逆序加载**：后加载的优先级更高（离工作目录越近越优先）。
 *    注入顺序 = 数组顺序，靠后的内容对模型影响更大。
 * 3. **@include 必须设防**：这是唯一会让程序去读**用户没直接指定**的文件的地方。
 *    若不加限制，一份恶意的 CLAUDE.md 里写 `@~/.ssh/id_rsa` 就能把私钥
 *    读进上下文。因此：限定在项目根内、限制扩展名、限制深度、路径去重防循环。
 */

import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { homedir } from 'node:os'

// ─────────────────────────────── 常量 ───────────────────────────────

/** 单层目录尝试加载的文件名（按优先级从低到高） */
export const INSTRUCTION_FILENAMES = ['CLAUDE.md'] as const
/** 本地覆盖文件（不入版本库，优先级最高） */
export const LOCAL_INSTRUCTION_FILENAME = 'CLAUDE.local.md'

/** @include 的最大嵌套深度 */
export const MAX_INCLUDE_DEPTH = 5

/** 单文件字符数告警阈值 */
export const MAX_INSTRUCTION_CHARS = 40_000

/** 所有指令文件合计的字符上限（防止多层级叠加后吃掉整个上下文） */
export const MAX_TOTAL_CHARS = 120_000

/**
 * @include 允许的文件扩展名。
 *
 * **白名单而非黑名单**：漏掉一个文本格式只是少读一个文件，
 * 而漏掉一个敏感格式（.pem/.key/.p12）会直接泄露凭据。
 */
const TEXT_FILE_EXTENSIONS = new Set([
  '.md', '.markdown', '.txt', '.rst',
  '.json', '.jsonc', '.json5', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts',
  '.py', '.rb', '.php', '.go', '.rs', '.java', '.kt', '.kts', '.scala', '.swift',
  '.c', '.h', '.cc', '.cpp', '.hpp', '.cs', '.m', '.mm',
  '.sh', '.bash', '.zsh', '.fish', '.ps1', '.psm1', '.bat', '.cmd',
  '.sql', '.graphql', '.proto',
  '.css', '.scss', '.sass', '.less', '.html', '.htm', '.vue', '.svelte',
  '.xml', '.svg', '.csv', '.tsv', '.env.example', '.gitignore', '.editorconfig',
  '.dockerfile', '.makefile', '.gradle', '.tf', '.hcl',
])

// ─────────────────────────────── 类型 ───────────────────────────────

export type InstructionSource = 'user' | 'project' | 'local'

export interface InstructionFile {
  /** 绝对路径 */
  path: string
  /** 文件内容（@include 已展开） */
  content: string
  source: InstructionSource
  /** 距工作目录的层级（0 = 工作目录本身，越大越上层） */
  depth: number
  /** 该文件展开进来的 include 文件路径 */
  includes: string[]
}

export interface LoadInstructionsOptions {
  /** 工作目录；默认 process.cwd() */
  cwd?: string
  /** 用户配置目录；默认 ~/.doge */
  userConfigDir?: string
  /** 是否加载用户级（~/.doge/CLAUDE.md） */
  includeUserLevel?: boolean
  /** 是否展开 @include；默认 true */
  resolveIncludes?: boolean
  /** 单文件上限；默认 40000 */
  maxFileChars?: number
  /** 合计上限；默认 120000 */
  maxTotalChars?: number
}

// ─────────────────────────────── 工具 ───────────────────────────────

async function readFileSafe(p: string): Promise<string | null> {
  try {
    const stat = await fs.stat(p)
    if (!stat.isFile()) return null
    return await fs.readFile(p, 'utf-8')
  } catch {
    return null
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

/**
 * 逐个向上枚举目录，从工作目录到盘根。
 *
 * 返回顺序为「由近到远」，调用方按**逆序**加载即可实现"越近优先级越高"。
 */
export function enumerateAncestorDirs(cwd: string): string[] {
  const out: string[] = []
  let cur = path.resolve(cwd)
  const seen = new Set<string>()
  while (true) {
    if (seen.has(cur)) break
    seen.add(cur)
    out.push(cur)
    const parent = path.dirname(cur)
    if (parent === cur) break // 已到盘根
    cur = parent
  }
  return out
}

/**
 * 枚举属于**同一个项目**的目录：向上查找，遇到 `.git` 就停。
 *
 * 与纯路径枚举的区别在于**项目边界**。这一点是实测发现的：
 * 若一直找到盘根，用户在上级目录（或其他无关目录）里放的 CLAUDE.md
 * 会被一并加载进当前项目 —— 那些约定与本项目无关，却会占上下文并误导模型。
 *
 * 实测案例：把 cwd 设成一个不存在的路径时，纯路径枚举会向上走到 D:\，
 * 于是加载了 D:\KX2API\CLAUDE.md —— 明显不该发生。
 *
 * git 仓库根是「项目边界」最可靠的近似；不是 git 项目则退化为枚举到盘根。
 */
export async function enumerateProjectDirs(cwd: string): Promise<string[]> {
  const all = enumerateAncestorDirs(cwd)
  const out: string[] = []
  for (const dir of all) {
    out.push(dir)
    if (await exists(path.join(dir, '.git'))) break
  }
  return out
}

// ─────────────────────────────── @include 解析 ───────────────────────────────

/**
 * 从 Markdown 中提取 @path 引用。
 *
 * 只处理**非代码块**内容 —— 代码示例里的 `@decorator` 不是文件引用，
 * 处理它们既会误读文件也会破坏代码展示。
 * 转义的 `\@` 不算引用。
 */
export function extractIncludeRefs(markdown: string): string[] {
  const refs: string[] = []
  const lines = markdown.split('\n')
  let inFence = false

  for (const line of lines) {
    // 代码围栏开关
    if (/^\s*(`{3,}|~{3,})/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    // 行内代码段先挖掉，避免 `@foo` 被当引用
    const withoutInlineCode = line.replace(/`[^`]*`/g, '')

    for (const m of withoutInlineCode.matchAll(/(^|[\s(])@((?:[^\s@\\]|\\.)+)/g)) {
      const raw = m[2].trim()
      if (raw) refs.push(raw)
    }
  }
  return refs
}

/** 判断扩展名是否在白名单内 */
export function isAllowedIncludeExt(filePath: string): boolean {
  const base = path.basename(filePath).toLowerCase()
  // 无扩展名的常见约定文件（Makefile / Dockerfile）单独放行
  if (base === 'makefile' || base === 'dockerfile' || base === 'license') return true
  const ext = path.extname(base).toLowerCase()
  if (!ext) return false
  return TEXT_FILE_EXTENSIONS.has(ext)
}

interface ExpandResult {
  text: string
  includes: string[]
}

/**
 * 展开 @include。
 *
 * 安全约束（缺一不可）：
 * - 解析后的真实路径必须仍在**项目根内** —— 挡住 `@~/.ssh/id_rsa` 与 `../../etc/passwd`
 * - 扩展名必须在白名单内 —— 挡住 `.pem` / `.key` 这类凭据文件
 * - 深度上限 —— 挡住 a 引用 b、b 引用 a 的循环
 * - 已处理路径集合 —— 同一文件只展开一次
 */
async function expandIncludes(
  content: string,
  baseDir: string,
  projectRoot: string,
  allowedRoots: string[],
  depth: number,
  visited: Set<string>,
  collected: string[],
  maxDepth: number,
): Promise<ExpandResult> {
  if (depth >= maxDepth) return { text: content, includes: collected }

  const refs = extractIncludeRefs(content)
  if (refs.length === 0) return { text: content, includes: collected }

  let out = content
  for (const ref of refs) {
    const target = path.resolve(baseDir, ref)

    // 必须在允许的根目录之一内
    const inAllowedRoot = allowedRoots.some(root => {
      const rel = path.relative(root, target)
      return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
    })
    if (!inAllowedRoot) continue
    if (!isAllowedIncludeExt(target)) continue
    if (visited.has(target)) continue

    const raw = await readFileSafe(target)
    if (raw == null) continue

    visited.add(target)
    collected.push(target)

    // 递归展开（以被引用文件的目录为基准）
    const nested = await expandIncludes(
      raw,
      path.dirname(target),
      projectRoot,
      allowedRoots,
      depth + 1,
      visited,
      collected,
      maxDepth,
    )

    // 替换引用为内容（保留缩进上下文）
    const block = `\n<!-- 引自 ${path.relative(projectRoot, target) || target} -->\n${nested.text.trim()}\n`
    out = out.split(`@${ref}`).join(block)
  }

  return { text: out, includes: collected }
}

// ─────────────────────────────── 主入口 ───────────────────────────────

/**
 * 加载项目指令文件。
 *
 * 返回顺序 = **注入顺序**：越靠后优先级越高（离工作目录越近的越靠后）。
 */
export async function loadInstructions(
  opts: LoadInstructionsOptions = {},
): Promise<InstructionFile[]> {
  const cwd = path.resolve(opts.cwd ?? process.cwd())
  const userConfigDir = opts.userConfigDir ?? path.join(homedir(), '.doge')
  const includeUserLevel = opts.includeUserLevel !== false
  const resolveIncludes = opts.resolveIncludes !== false
  const maxFileChars = opts.maxFileChars ?? MAX_INSTRUCTION_CHARS
  const maxTotalChars = opts.maxTotalChars ?? MAX_TOTAL_CHARS

  const collected: InstructionFile[] = []
  const visitedPaths = new Set<string>()

  const tryLoad = async (
    filePath: string,
    source: InstructionSource,
    depth: number,
    projectRoot: string,
    allowedRoots: string[],
  ): Promise<void> => {
    if (visitedPaths.has(filePath)) return
    const raw = await readFileSafe(filePath)
    if (raw == null) return
    visitedPaths.add(filePath)

    let text = raw.trim()
    if (!text) return

    const includes: string[] = []
    if (resolveIncludes) {
      try {
        const expanded = await expandIncludes(
          text,
          path.dirname(filePath),
          projectRoot,
          allowedRoots,
          0,
          visitedPaths,
          includes,
          MAX_INCLUDE_DEPTH,
        )
        text = expanded.text
      } catch (e) {
        // @include 展开失败不该让整个指令加载失败 —— 至少保留原文
        console.warn(`[Instructions] @include 展开失败 ${filePath}: ${(e as Error).message}`)
      }
    }

    if (text.length > maxFileChars) {
      console.warn(
        `[Instructions] ${path.relative(projectRoot, filePath)} 超过 ${maxFileChars} 字符，已截断`,
      )
      text = `${text.slice(0, maxFileChars)}\n\n<!-- 内容过长，已截断 -->`
    }

    collected.push({ path: filePath, content: text, source, depth, includes })
  }

  // 入口校验：cwd 必须是一个真实存在的目录。
  // 否则路径会向上解析到无关目录，把别人的 CLAUDE.md 加载进来。
  if (!(await exists(cwd))) {
    return []
  }

  // ── 1. 逐级向上收集项目级指令（由远到近，越近越后加载 → 优先级越高）──
  const ancestors = await enumerateProjectDirs(cwd) // 由近到远
  const ordered = [...ancestors].reverse() // 由远到近

  for (let i = 0; i < ordered.length; i++) {
    const dir = ordered[i]
    const depth = ancestors.indexOf(dir) // 0 = 工作目录
    for (const name of INSTRUCTION_FILENAMES) {
      await tryLoad(path.join(dir, name), 'project', depth, cwd, [cwd, dir])
    }
  }

  // ── 2. 本地覆盖文件（优先级最高，最后加载）──
  for (const dir of ancestors) {
    const depth = ancestors.indexOf(dir)
    await tryLoad(path.join(dir, LOCAL_INSTRUCTION_FILENAME), 'local', depth, cwd, [cwd, dir])
  }

  // ── 3. 用户级（优先级最低，最先加载）──
  if (includeUserLevel) {
    try {
      const userFile = path.join(userConfigDir, 'CLAUDE.md')
      const raw = await readFileSafe(userFile)
      if (raw && raw.trim()) {
        // 用户级插到最前面 —— 项目约定应能覆盖全局约定
        collected.unshift({
          path: userFile,
          content: raw.trim(),
          source: 'user',
          depth: -1,
          includes: [],
        })
      }
    } catch {
      /* 用户级可选 */
    }
  }

  // ── 4. 合计预算（超出则丢弃靠前的低优先级内容）──
  let total = 0
  const budgeted: InstructionFile[] = []
  for (let i = collected.length - 1; i >= 0; i--) {
    const f = collected[i]
    if (total + f.content.length > maxTotalChars) {
      console.warn(
        `[Instructions] 合计超过 ${maxTotalChars} 字符，丢弃低优先级的 ${path.basename(f.path)}`,
      )
      continue
    }
    total += f.content.length
    budgeted.unshift(f)
  }

  return budgeted
}

/**
 * 渲染成注入用的文本块。
 *
 * 格式对齐上游：`${path} 的内容：\n\n${content}`，
 * 并附带"来源路径"让模型知道某条约定出自哪一层。
 */
export function formatInstructionsForPrompt(files: InstructionFile[]): string | null {
  if (files.length === 0) return null

  const blocks = files.map(f => {
    const label = f.source === 'user' ? '用户全局' : f.source === 'local' ? '本地覆盖' : '项目'
    return `### ${label}：${f.path}\n\n${f.content}`
  })

  return [
    '以下是本项目的指令文件（CLAUDE.md），其中的约定优先于你的默认习惯：',
    '',
    blocks.join('\n\n---\n\n'),
  ].join('\n')
}

/** 一步到位：加载 + 渲染。无指令文件时返回 null */
export async function buildInstructionsSection(
  opts: LoadInstructionsOptions = {},
): Promise<string | null> {
  try {
    const files = await loadInstructions(opts)
    return formatInstructionsForPrompt(files)
  } catch (e) {
    console.warn('[Instructions] 加载失败，跳过:', (e as Error).message)
    return null
  }
}
