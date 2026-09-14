/**
 * 错误 ID 常量
 * 集中管理所有错误码，便于追踪和国际化
 */

export const ERROR_IDS = {
  TOOL_USE_SUMMARY_GENERATION_FAILED: 'tool_use_summary_generation_failed',
  API_REQUEST_FAILED: 'api_request_failed',
  STREAM_INTERRUPTED: 'stream_interrupted',
  TOOL_EXECUTION_FAILED: 'tool_execution_failed',
  CONTEXT_COMPACTION_FAILED: 'context_compaction_failed',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  INVALID_CONFIG: 'invalid_config',
} as const

export type ErrorId = (typeof ERROR_IDS)[keyof typeof ERROR_IDS]
