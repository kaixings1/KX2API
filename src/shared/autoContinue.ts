/**
 * shared/autoContinue.ts — 自动流程控制（渲染层可用出口）
 *
 * 类型权威定义在 src/engine/messageLoop.ts 的 AutoContinueConfig。
 * 此处转发一份，让渲染层可以走 @shared 别名导入（渲染进程不直接依赖 engine 目录）。
 * 所有字段均可选，缺省时引擎回落默认值（见 messageLoop.ts 的 ?? false / ?? true / loopLimits）。
 */

export type { AutoContinueConfig } from '../engine/messageLoop'

/** 自动流程控制的默认值（仅用于 UI 回显；实际判定以 messageLoop.ts 内 ?? 兜底为准） */
export const DEFAULT_AUTO_CONTINUE_CONFIG: Required<Omit<import('../engine/messageLoop').AutoContinueConfig, 'maxCount'>> & { maxCount: number } = {
  enabled: false,
  maxCount: 5,
  readSearch: true,
  continueKeyword: false,
  intentOnly: false,
  endTurn: false,
}