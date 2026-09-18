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
 *
 * 返回记忆文件列表（不包含 MEMORY.md 索引）。
 *
 * ⚠️ 当前为空实现，且**不可**用 memoryRecall.scanMemories 直接顶替：
 *   - scanMemories 的参数是「记忆目录」（需 resolveMemoryDir 转换），
 *     而本函数拿到的是「项目路径」；
 *   - MemoryEntry 只有元数据（file/absPath/name/description/type/mtimeMs），
 *     **不含正文**，而调用方要的是 `content`；
 *   - MemoryEntry.type 可空，本函数 MemoryFile.scope 必填。
 * 三者相加说明二者语义不同，硬接会得到一个「字段全对不上」的结果。
 *
 * 项目里真正提供「带正文的项目指令文件」的是 instructions/claudeMdLoader.ts
 * （loadInstructions / formatInstructionsForPrompt，429 行完整实现）。
 * 因此 userContext 改为直接走它，本函数保留给「只需要元数据」的场景。
 */
export function getMemoryFiles(_projectPath: string): MemoryFile[] {
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
