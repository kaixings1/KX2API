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

/** 把 AgentEvent 映射为 QueryChunk（无法映射的事件返回 undefined，静默忽略） */
function toChunk(event: AgentEvent): QueryChunk | undefined {
  const e = event as Record<string, unknown>
  switch (event.type) {
    case 'response_chunk':
      return { type: 'message', data: { role: 'assistant', content: String(e.content ?? '') } }
    case 'tool_call_start':
      return {
        type: 'tool_use',
        data: {
          id: String(e.toolUseId ?? ''),
          name: String(e.toolName ?? ''),
          input: (e.input as Record<string, unknown>) ?? {},
        },
      }
    case 'tool_result':
      return {
        type: 'tool_result',
        data: { toolUseId: String(e.toolUseId ?? ''), output: String(e.content ?? '') },
      }
    case 'done':
      return {
        type: 'done',
        data: {
          iterations: Number(e.iterations ?? 0),
          duration: Number(e.duration ?? 0),
        },
      }
    case 'error':
      return { type: 'error', data: { message: String(e.error ?? 'unknown error') } }
    default:
      return undefined
  }
}

/**
 * 异步查询生成器：包装 QueryEngine.query() 为可迭代 chunk 流。
 *
 * 用法：
 *   const gen = createQueryGenerator(engine)
 *   for await (const chunk of gen) { ... }
 *
 * ⚠️ 实现要点：`engine.query()` 是一次返回 Promise 的调用，而事件是在
 * 执行**过程中**通过 handler 回调推送的。若只把 chunk 推进数组、等 query
 * 返回后再 yield，调用方在 query 期间**收不到任何东西**（等于流式接口
 * 不流式，且中间 chunk 全丢）。这里用一个异步队列把「回调推送」与
 * 「生成器消费」桥接起来：push 时唤醒等待中的 next()。
 */
export async function* createQueryGenerator(
  engine: Pick<QueryEngine, 'query'>,
  params: QueryParams,
): AsyncGenerator<QueryChunk> {
  const queue: QueryChunk[] = []
  let notify: (() => void) | null = null
  let finished = false

  const wake = () => {
    const n = notify
    notify = null
    n?.()
  }

  const handler = (event: AgentEvent) => {
    const chunk = toChunk(event)
    if (!chunk) return
    queue.push(chunk)
    params.options?.onChunk?.(chunk)
    wake()
  }

  const run = engine
    .query(params.query, handler)
    .then((result) => {
      queue.push({
        type: 'done',
        data: { iterations: result.iterations, duration: result.duration },
      })
    })
    .catch((e: unknown) => {
      queue.push({ type: 'error', data: { message: e instanceof Error ? e.message : String(e) } })
    })
    .finally(() => {
      finished = true
      wake()
    })

  // 边执行边消费：只要队列非空就立刻 yield，队列空则等下一次 push 唤醒。
  while (!finished || queue.length > 0) {
    if (queue.length > 0) {
      yield queue.shift() as QueryChunk
      continue
    }
    await new Promise<void>((resolve) => {
      notify = resolve
    })
  }

  // 保证 query() 的拒绝不会变成未处理 Promise
  await run
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
        } as unknown,
      ]),
    ) as unknown as Map<string, never>,
  } as never)

  yield* createQueryGenerator(engine, params)
}
