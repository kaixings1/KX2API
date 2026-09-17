/**
 * engine/hooks/index.ts — Hook 子系统入口
 */

export {
  HookManager,
  getHookManager,
  resetHookManager,
  type HookEventType,
  type HookHandler,
  type HookResult,
  type HookEvent,
} from './hookManager.ts'

export {
  createSecretDetectionHook,
  createFileTypeWarningHook,
  createToolAuditLogHook,
  createSessionStartHook,
  createFailureTrackerHook,
} from './builtInHooks.ts'
