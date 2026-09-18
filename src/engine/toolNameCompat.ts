/**
 * engine/toolNameCompat.ts — 工具名的「概念归类」单一真源
 *
 * 背景（为什么需要这个文件）
 * --------------------------
 * 本项目里工具名存在**两套写法**，且各自都在被使用：
 *
 *   1. 注册命令名（权威）：`ls` / `cat` / `bash` / `find` …
 *      —— 由 `commandRunners` 注册，是**真正被调度执行**的名字。
 *   2. 历史别名（Claude Code 风格）：`ListFiles` / `Read` / `Bash` / `Glob` …
 *      —— 散落在权限规则默认值、沙箱白名单、hooks 匹配键、缓存名单里，
 *         也大量出现在**用户已保存的配置**与**测试**中。
 *
 * 问题：两套名字直接 `===` 比较时永远不相等。最严重的一例是
 * `CommandFilterPolicy` 里 `toolName !== 'Bash'` —— 实际工具名是 `bash`，
 * 于是**危险命令拦截（rm -rf 等）从未生效过**。
 *
 * 解决：不再各处硬编码名字，统一用本模块的「概念归类」做判断。
 * 任何一侧的写法（`bash` 或 `Bash`）都能被正确归类，两个方向都兼容。
 *
 * 设计约束
 * --------
 * - **不改注册命令名**：注册名是执行侧的权威，改动会波及所有调用方。
 * - **不改用户配置的语义**：用户存的规则名原样保留，只是判断时能归类。
 * - 本模块只做「归类/判定」，不做「重命名」。重命名请走
 *   `toolNameResolver.resolveToolName`（那是"模型自造名 → 注册名"的另一件事）。
 */

/** 工具概念：与具体写法无关的语义分类 */
export type ToolConcept =
  | 'shell' // 执行命令：bash / cmd / shell …
  | 'list' // 列目录：ls / dir …
  | 'read' // 读文件：cat / head / tail …
  | 'write' // 写/改文件（本项目仅有 cp/mv 这类，无独立写文件命令）
  | 'search' // 搜索：find / grep / findstr …
  | 'web' // 联网检索
  | 'code' // 执行代码
  | 'unknown'

/**
 * 别名 → 概念。
 *
 * 键统一按**小写**索引（判定时会 toLowerCase），因此 `bash`/`Bash`/`BASH`
 * 都能命中同一条。这正是不再需要两套名字比较的关键。
 */
const CONCEPT_BY_ALIAS: Record<string, ToolConcept> = {
  // 执行命令
  bash: 'shell', cmd: 'shell', shell: 'shell', sh: 'shell',
  powershell: 'shell', ps1: 'shell', batch: 'shell',
  exec: 'shell', execute: 'shell', run: 'shell',
  execute_command: 'shell', run_command: 'shell',

  // 列目录
  ls: 'list', dir: 'list', list: 'list', listfiles: 'list',
  list_dir: 'list', list_directory: 'list', list_files: 'list',
  ls_dir: 'list', tree: 'list',

  // 读文件
  cat: 'read', head: 'read', tail: 'read', read: 'read',
  read_file: 'read', read_file_content: 'read', type: 'read',

  // 写/改文件（本项目无独立写文件命令；cp/mv 属文件搬运）
  write: 'write', edit: 'write', write_file: 'write', write_to_file: 'write',
  replace_in_file: 'write', str_replace_editor: 'write', multiedit: 'write',
  multifileedit: 'write', cp: 'write', mv: 'write', mkdir: 'write',

  // 搜索
  find: 'search', glob: 'search', grep: 'search', findstr: 'search',
  search: 'search', search_files: 'search', search_content: 'search',
  find_file: 'search', find_files: 'search', wc: 'search',

  // 联网
  web_search: 'web', websearch: 'web', fetch_url: 'web',
  web_extractor: 'web', webextractor: 'web',

  // 执行代码
  code_interpreter: 'code', codeinterpreter: 'code', execute_code: 'code',
}

/** 概念 → 该项目里"文件操作类"的概念集合（沙箱/路径守卫用） */
const FILE_CONCEPTS: ReadonlySet<ToolConcept> = new Set<ToolConcept>(['read', 'write', 'list', 'search'])

/** 概念 → 该项目里"执行命令类"的概念集合（命令过滤用） */
const SHELL_CONCEPTS: ReadonlySet<ToolConcept> = new Set<ToolConcept>(['shell', 'code'])

/** 取得某个工具名（任意写法）对应的概念；识别不出返回 'unknown' */
export function getToolConcept(toolName: string | undefined | null): ToolConcept {
  if (!toolName) return 'unknown'
  const key = String(toolName).trim().toLowerCase()
  const direct = CONCEPT_BY_ALIAS[key]
  if (direct) return direct
  // 处理带命名空间的写法：mcp.server.ls、functions.bash、tool:Read
  const tail = key.split(/[.:/]/).pop()
  if (tail && CONCEPT_BY_ALIAS[tail]) return CONCEPT_BY_ALIAS[tail]
  return 'unknown'
}

/** 是否为文件操作类工具（任意写法都能识别） */
export function isFileTool(toolName: string | undefined | null): boolean {
  return FILE_CONCEPTS.has(getToolConcept(toolName))
}

/** 是否为"执行命令"类工具（任意写法都能识别） */
export function isShellTool(toolName: string | undefined | null): boolean {
  return SHELL_CONCEPTS.has(getToolConcept(toolName))
}

/**
 * 给定一个工具名，返回它在当前项目里**所有可被识别的写法**。
 *
 * 用途：需要与"用户配置的规则名 / 历史名单"做匹配时，
 * 不再假设对方用哪套写法，把候选集全给它。
 *
 * 例：getToolNameVariants('bash') → ['bash','Bash','cmd','shell',...]
 */
export function getToolNameVariants(toolName: string | undefined | null): string[] {
  const concept = getToolConcept(toolName)
  if (concept === 'unknown') return toolName ? [String(toolName)] : []
  const out = new Set<string>()
  for (const [alias, c] of Object.entries(CONCEPT_BY_ALIAS)) {
    if (c === concept) out.add(alias)
  }
  // 常见首字母大写写法（历史代码大量使用）
  for (const alias of [...out]) {
    out.add(alias.charAt(0).toUpperCase() + alias.slice(1))
  }
  return [...out]
}

/**
 * 判断两个工具名是否**指向同一个工具**（跨写法比较）。
 *
 * 这是替代 `a === b` 的安全写法：
 *   isSameTool('bash', 'Bash') → true
 *   isSameTool('ls', 'ListFiles') → true
 *   isSameTool('cat', 'ls') → false
 */
export function isSameTool(a: string | undefined | null, b: string | undefined | null): boolean {
  const ca = getToolConcept(a)
  const cb = getToolConcept(b)
  if (ca === 'unknown' || cb === 'unknown') {
    // 认不出概念时退回字面比较（大小写不敏感），避免把两个未知名误判为同一个
    return String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase()
  }
  return ca === cb
}
