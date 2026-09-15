/**
 * engine/toolNameResolver.ts — 工具名归一发器（独立模块）
 *
 * 把模型/MCP/XML 中发出的各种「自造工具名」归一化到引擎真实注册的命令名。
 *
 * 为什么独立成模块：
 *   此前的实现放在 engine/api/client.ts，被 messageLoop 通过 `await import(...)` 解构引用。
 *   electron-vite 打包时 client 被多个 chunk 共用，rollup 会对该导出做内部重命名
 *   （例如 `resolveToolName` → `resolveToolName2`），导致 `const { resolveToolName } = await import(...)`
 *   在运行时解构不到真实函数而报错。
 * 独立模块 + 静态具名 import 后，符号名稳定，不被 chunk 重命名，彻底根除该类问题。
 */

/** 命名空间前缀（`filesystem.`、`fs::`、`app/` 等）分段后取最后一段作为基础名 */
const SEPARATOR_RE = /[./:\\]+/

/** 常见的「自造名 → 注册命令」别名表（与 client.ts 保持一致的语义覆盖） */
export const TOOL_ALIASES: Record<string, string> = {
  // 目录 / 文件列举
  '_current_directory': 'pwd',
  'current_directory': 'pwd',
  'get_current_directory': 'pwd',
  'list_current_directory': 'ls',
  'list_directory': 'ls',
  'dir_list': 'dir',
  'list_dir': 'ls',
  'list_files': 'ls',
  'ls_dir': 'ls',
  'read_directory': 'ls',
  'show_directory': 'ls',
  // local_* 系
  'local_dir': 'ls',
  'local_directory': 'ls',
  'local_dirs': 'ls',
  'local_list': 'ls',
  'local_list_dir': 'ls',
  'local_dir_list': 'dir',
  'local_list_directory': 'ls',
  'local_files': 'ls',
  'local_file': 'cat',
  'local_cat': 'cat',
  'local_read': 'cat',
  'local_grep': 'grep',
  'local_search': 'find',
  'local_find': 'find',
  'local_pwd': 'pwd',
  'local_tree': 'tree',
  // 文件读取 / 写入 / 搜索
  'read_file': 'cat',
  'readfile': 'cat',
  'get_file': 'cat',
  'write_file': 'echo',
  'edit_file': 'echo',
  'search_files': 'grep',
  'grep_search': 'grep',
  'find_file': 'find',
  'find_files': 'find',
  'search_text': 'findstr',
  'findstr_search': 'findstr',
  // 系统 / 环境
  'current_path': 'pwd',
  'print_directory': 'pwd',
  'print_working_directory': 'pwd',
  'environment': 'env',
  'show_env': 'env',
  'process_list': 'ps',
  'list_process': 'ps',
  'docker': 'docker',
  'git_branch': 'git-branch',
  'git_diff': 'git-diff',
  'git_log': 'git-log',
  'git_status': 'git-status',
  'list_branch': 'git-branch',
  'list_diff': 'git-diff',
  'list_log': 'git-log',
  'list_status': 'git-status',
}

/**
 * 将「模型/XML 中的工具名」归一化为可注册命令的真实命令名。
 * 命中返回归一化后的命令名，未命中返回 null。
 */
export async function resolveToolName(name: string, registry?: {
  get: (n: string) => unknown
  getNames: () => string[]
}): Promise<string | null> {
  const commandRegistry = registry ?? (await import('./commands/registry')).commandRegistry

  // 候选名集合：原始名、剥离时间戳/数字后缀、剥离命名空间前缀后的末段名。
  // 覆盖模型/框架常自造的名：
  //   - local_dir_list_20260915    （动词短语 + 时间戳）
  //   - filesystem.list_directory  （命名空间 + 点分段）
  //   - fs::read_file / list::dir  （冒号命名空间）
  const candidates = new Set<string>([name])
  // 1) 剥离尾部数字 / 时间戳 / 长后缀
  const stripped = name
    .replace(/_(?:20\d{2}|19\d{2})\d{4,}$/, '')
    .replace(/_\d{4,}$/, '')
    .replace(/_\w{6,}$/, '')
  if (stripped !== name) candidates.add(stripped)
  // 2) 剥掉命名空间前缀，取最后一段作为基础名
  const baseSeg = name.split(SEPARATOR_RE).pop()
  if (baseSeg && baseSeg !== name) candidates.add(baseSeg)
  // 3) 对剥离时间戳后的名再取一次末段（filesystem.list_directory_2026 → list_directory）
  const strippedSeg = stripped.split(SEPARATOR_RE).pop()
  if (strippedSeg && strippedSeg !== stripped && strippedSeg !== baseSeg) candidates.add(strippedSeg)

  for (const cand of candidates) {
    // 精确命中
    if (commandRegistry.get(cand)) return cand
    // 别名命中（含 local_*、list_directory 等）
    const lo = cand.toLowerCase()
    const alias = TOOL_ALIASES[lo]
    if (alias && commandRegistry.get(alias)) return alias
  }

  // 4) 去掉下划线 / 连字符 / 点 / 冒号等分隔符后的扁平名模糊匹配
  const flatten = (s: string) => s.replace(/[_\-.\/\\:]/g, '')
  for (const candBase of [...candidates]) {
    const candFlat = flatten(candBase)
    for (const candidate of commandRegistry.getNames()) {
      if (flatten(candidate) === candFlat) return candidate
    }
  }
  return null
}