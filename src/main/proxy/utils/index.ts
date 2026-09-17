/**
 * Utils Module - Export all utility functions for tool calling
 */

export * from './tools'
// 新的统一工具解析模块
export * from './toolParser/index'
// 保留旧的 streamToolHandler 以保持向后兼容
// 注意：streamToolHandler 与 toolParser 之间存在同名成员（flushToolCallBuffer /
// shouldBlockOutput 等），直接 `export *` 会触发 TS2308 重名冲突。
// 这里只 re-export 其独有的 createBaseChunk 与 ToolCallState，其余重叠 API
// 以 toolParser/index 为准。
export type { ToolCallState } from './streamToolHandler'
export { createBaseChunk } from './streamToolHandler'