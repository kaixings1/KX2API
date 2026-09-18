/**
 * engine/utils/claudeMd.ts — CLAUDE.md 外部引用解析
 *
 * 吸收自 D:\src\utils/claudemd.ts 的外部引用功能。
 */

/** 记忆文件 */
export interface MemoryFile {
  path: string
  content: string
  scope: 'user' | 'feedback' | 'project' | 'reference'
  lastAccessed: number
}

/**
 * 解析 CLAUDE.md 中的 @include 指令。
 * 返回引用的文件路径列表。
 */
export function getExternalClaudeMdIncludes(content: string): string[] {
  const includes: string[] = []
  const regex = /@include\s+([^\s]+)/g
  let match
  while ((match = regex.exec(content)) !== null) {
    includes.push(match[1].trim())
  }
  return includes
}

/**
 * 扫描项目路径下的记忆文件。
 * 返回记忆文件列表（不包含 MEMORY.md 索引）。
 */
export function getMemoryFiles(projectPath: string): MemoryFile[] {
  // 实际实现由 main 进程文件系统操作提供
  // 这里提供接口定义，实际扫描延迟到需要时
  return []
}

/**
 * 检查是否需要显示外部引用警告。
 * 当 CLAUDE.md 包含 @include 但引用文件不存在时触发。
 */
export function shouldShowClaudeMdExternalIncludesWarning(
  includes: string[],
  existingPaths: Set<string>,
): boolean {
  return includes.some(inc => !existingPaths.has(inc))
}
