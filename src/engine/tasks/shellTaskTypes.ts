/**
 * engine/tasks/shellTaskTypes.ts — Shell 任务类型
 *
 * 实现 LocalShellSpawnInput 和 Shell 任务相关类型。
 */

/** Shell 任务启动输入参数 */
export interface LocalShellSpawnInput {
  command: string
  args?: string[]
  cwd?: string
  env?: Record<string, string>
  timeout?: number
  stdin?: string
  shell?: boolean
}

/** Shell 任务上下文 */
export interface ShellTaskContext {
  spawnInput: LocalShellSpawnInput
  process?: unknown
  exitCode?: number
}
