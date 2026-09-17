/**
 * main/hooks/types.ts — 钩子的类型定义
 *
 * 移植自 D:\src\utils\hooks.ts + D:\src\entrypoints\sdk\coreTypes.ts 的 HOOK_EVENTS。
 * 钩子让外部脚本能在主循环的关键节点介入：拦工具调用、注入上下文、阻止继续执行。
 */

/** 钩子事件全集（对齐上游 27 个事件，去掉本项目没有对应概念的部分） */
export const HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'Notification',
  'UserPromptSubmit',
  'SessionStart',
  'SessionEnd',
  'Stop',
  'SubagentStart',
  'SubagentStop',
  'PreCompact',
  'PostCompact',
  'PermissionRequest',
  'PermissionDenied',
  'Setup',
  'TaskCreated',
  'TaskCompleted',
] as const

export type HookEvent = (typeof HOOK_EVENTS)[number]

export function isHookEvent(v: string): v is HookEvent {
  return (HOOK_EVENTS as readonly string[]).includes(v)
}

/** 单条钩子命令 */
export interface HookCommand {
  /** 目前只支持 command（上游还有 function / http 类型，本项目未用） */
  type: 'command'
  /** 要执行的 shell 命令 */
  command: string
  /** 超时秒数；未给则用事件默认值 */
  timeout?: number
}

/** 一个匹配器下挂的若干钩子 */
export interface HookMatcher {
  /**
   * 匹配模式（正则，忽略大小写）。
   * 含义随事件而定：
   *   PreToolUse / PostToolUse → 工具名
   *   SessionStart            → source（startup / resume / clear）
   *   PreCompact              → trigger（manual / auto）
   *   FileChanged             → 文件名
   * 留空或 "*" 表示匹配该事件的全部触发。
   */
  matcher?: string
  hooks: HookCommand[]
}

/** hooks 配置文件结构（对齐 Claude Code settings.json 的 hooks 段） */
export interface HooksConfig {
  hooks?: Partial<Record<HookEvent, HookMatcher[]>>
}

/** 钩子执行结果 */
export interface HookResult {
  /** 阻止主循环继续（`continue: false`） */
  preventContinuation?: boolean
  /** 阻止原因 */
  stopReason?: string
  /** 阻塞性错误：会作为反馈喂回模型（`decision: 'block'`） */
  blockingError?: { blockingError: string; command: string }
  /** 权限裁决：PreToolUse 里 allow/deny */
  permissionBehavior?: 'allow' | 'deny' | 'ask'
  /** 展示给用户的系统消息 */
  systemMessage?: string
  /** 追加进上下文的文本 */
  additionalContext?: string
  /** 执行失败（非阻塞） */
  error?: string
}

/** 单个钩子执行时上报给 UI 的进度 */
export interface HookProgress {
  event: HookEvent
  command: string
  /** 进程退出码；未结束为 undefined */
  exitCode?: number
  stdout?: string
  stderr?: string
  durationMs?: number
  timedOut?: boolean
}

/** 事件触发上下文 */
export interface HookContext {
  event: HookEvent
  /** 用于 matcher 匹配的键（工具名 / source / trigger 等） */
  matchKey?: string
  /** 传给钩子的结构化输入（会作为 JSON 从 stdin 传入） */
  payload?: Record<string, unknown>
  /** 会话 id */
  sessionId?: string
  /** 工作目录 */
  cwd?: string
}
