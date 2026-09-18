/**
 * engine/query/queryGenerator.ts — 异步查询生成器
 *
 * 吸收自 D:\src\query.ts 的 async generator 模式。
 * 将现有 QueryEngine 的流式输出包装为可迭代的 chunk 流。
 */

import type { AgentEvent } from '../messageLoop.ts'
import type { QueryEngine } from '../index.ts'

/** 查询参数 */
export interface QueryParams {
  query: string
  options?: {
    maxRounds?: number
    tools?: Array<{ name: string; description: string; parameters?: Record<string, unknown> }>
    systemPrompt?: string
    onChunk?: (chunk: QueryChunk) => void
  }
}

/** 查询产出块 */
export type QueryChunk =
  | { type: 'message'; data: { role: string; content: string } }
  | { type: 'tool_use'; data: { id: string; name: string; input: Record<string, unknown> } }
  | { type: 'tool_result'; data: { toolUseId: string; output: string } }
  | { type: 'done'; data: { iterations: number; duration: number } }
  | { type: 'error'; data: { message: string } }

/**
 * 异步查询生成器：包装 QueryEngine.query() 为可迭代 chunk 流。
 *
 * 用法：
 *   const gen = createQueryGenerator(engine)
 *   for await (const chunk of gen) { ... }
 */
export async function* createQueryGenerator(
  engine: Pick<QueryEngine, 'query'>,
  params: QueryParams,
): AsyncGenerator<QueryChunk> {
  const chunks: QueryChunk[] = []
  const onEvent = params.options?.onChunk

  const handler = (event: AgentEvent) => {
    let chunk: QueryChunk | undefined

    switch (event.type) {
      case 'response_chunk':
        chunk = { type: 'message', data: { role: 'assistant', content: String((event as Record<string, unknown>).content ?? '') } }
        break
      case 'tool_call_start':
        chunk = { type: 'tool_use', data: { id: (event as Record<string, unknown>).toolUseId as string, name: ((event as Record<string, unknown>).toolName as string) ?? '', input: (event as Record<string, unknown>).input as Record<string, unknown> || {} } }
        break
      case 'tool_result':
        chunk = { type: 'tool_result', data: { toolUseId: (event as Record<string, unknown>).toolUseId as string, output: String((event as Record<string, unknown>).content ?? '') } }
        break
      case 'done':
        chunk = { type: 'done', data: { iterations: (event as Record<string, unknown>).iterations as number ?? 0, duration: (event as Record<string, unknown>).duration as number ?? 0 } }
        break
      case 'error':
        chunk = { type: 'error', data: { message: String((event as Record<string, unknown>).error ?? 'unknown error') } }
        break
    }

    if (chunk) {
      chunks.push(chunk)
      onEvent?.(chunk)
    }
  }

  try {
    const result = await engine.query(params.query, handler)
    yield { type: 'done', data: { iterations: result.iterations, duration: result.duration } }
  } catch (e) {
    yield { type: 'error', data: { message: e instanceof Error ? e.message : String(e) } }
  }
}

/**
 * 便捷函数：直接运行查询并产出所有 chunk
 */
export async function* query(params: QueryParams): AsyncGenerator<QueryChunk> {
  // 延迟导入避免循环依赖
  const { QueryEngine } = await import('../index.ts')
  const engine = new QueryEngine({
    model: 'default',
    systemPrompt: params.options?.systemPrompt,
    tools: new Map(
      (params.options?.tools ?? []).map(t => [
        t.name,
        {
          name: t.name,
          description: t.description,
          execute: async () => ({ content: '', success: true }),
          parameters: t.parameters ?? {},
        } as Parameters<typeof QueryEngine.prototype['query']>[0] extends never ? never : unknown,
      ]),
    ) as any,
  } as any)

  yield* createQueryGenerator(engine, params)
}
