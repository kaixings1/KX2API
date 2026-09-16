/**
 * shared/loopConfig.ts — Agent 循环控制参数（渲染层可用出口）
 *
 * 类型与默认值的权威定义在 src/engine/loopConfig.ts。
 * 此处转发一份，让渲染层可以走 @shared 别名导入（渲染进程不直接依赖 engine 目录）。
 *
 * 注意：默认值必须与 engine 侧保持一致，改一边务必同步另一边。
 */

export type { AgentLoopConfig } from '../engine/loopConfig'
export { DEFAULT_AGENT_LOOP_CONFIG, resolveLoopConfig } from '../engine/loopConfig'
