/**
 * engine/context/promptInjection.ts — 系统提示注入
 *
 * 支持缓存破坏（cache breaker）和临时调试状态注入。
 */

let _injection: string | null = null

/** 获取当前注入值 */
export function getSystemPromptInjection(): string | null {
  return _injection
}

/** 设置注入值，并清除相关缓存 */
export function setSystemPromptInjection(value: string | null): void {
  _injection = value
}
