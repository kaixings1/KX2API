/**
 * engine/query queryGenerator 测试
 *
 * createQueryGenerator 把 QueryEngine.query() 的事件流包装成 AsyncGenerator。
 *
 * 含真实缺陷回归：
 *   生成器内部把每个 chunk 推入 `chunks` 数组却**从不 yield**，
 *   调用方 for-await 只能拿到最后那一个 done —— 等于流式接口不流式。
 *   这里锁定「中间 chunk 必须能被逐个消费」。
 *
 * 运行：node --import tsx --test tests/engine/query-generator.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { createQueryGenerator, type QueryChunk } from '../../src/engine/query/queryGenerator.ts'

/** 造一个会按给定事件序列回调 handler 的假引擎 */
function fakeEngine(events: Array<Record<string, unknown>>, result = { iterations: 3, duration: 123 }) {
  return {
    async query(_q: string, handler?: (e: unknown) => void) {
      for (const e of events) handler?.(e)
      return result
    },
  } as unknown as { query: (q: string, h?: (e: unknown) => void) => Promise<typeof result> }
}

describe('createQueryGenerator — chunk 映射', () => {
  test('response_chunk 映射为 message chunk', async () => {
    const engine = fakeEngine([{ type: 'response_chunk', content: '你好' }])
    const out: QueryChunk[] = []
    for await (const c of createQueryGenerator(engine as never, { query: 'q' })) out.push(c)

    const msg = out.find((c) => c.type === 'message')
    assert.ok(msg, `应产出 message chunk，实际：${JSON.stringify(out)}`)
    assert.equal((msg as { data: { content: string } }).data.content, '你好')
    assert.equal((msg as { data: { role: string } }).data.role, 'assistant')
  })

  test('tool_call_start 映射为 tool_use chunk', async () => {
    const engine = fakeEngine([
      { type: 'tool_call_start', toolUseId: 't1', toolName: 'read', input: { path: 'a' } },
    ])
    const out: QueryChunk[] = []
    for await (const c of createQueryGenerator(engine as never, { query: 'q' })) out.push(c)

    const tu = out.find((c) => c.type === 'tool_use')
    assert.ok(tu, '应产出 tool_use chunk')
    const d = (tu as { data: { id: string; name: string; input: Record<string, unknown> } }).data
    assert.equal(d.id, 't1')
    assert.equal(d.name, 'read')
    assert.deepEqual(d.input, { path: 'a' })
  })

  test('tool_result 映射为 tool_result chunk', async () => {
    const engine = fakeEngine([{ type: 'tool_result', toolUseId: 't1', content: '文件内容' }])
    const out: QueryChunk[] = []
    for await (const c of createQueryGenerator(engine as never, { query: 'q' })) out.push(c)

    const tr = out.find((c) => c.type === 'tool_result')
    assert.ok(tr)
    const d = (tr as { data: { toolUseId: string; output: string } }).data
    assert.equal(d.toolUseId, 't1')
    assert.equal(d.output, '文件内容')
  })

  test('error 事件映射为 error chunk', async () => {
    const engine = fakeEngine([{ type: 'error', error: '炸了' }])
    const out: QueryChunk[] = []
    for await (const c of createQueryGenerator(engine as never, { query: 'q' })) out.push(c)
    const err = out.find((c) => c.type === 'error')
    assert.ok(err)
    assert.equal((err as { data: { message: string } }).data.message, '炸了')
  })

  test('终止时产出 done chunk，携带迭代与你耗时', async () => {
    const engine = fakeEngine([], { iterations: 7, duration: 999 })
    const out: QueryChunk[] = []
    for await (const c of createQueryGenerator(engine as never, { query: 'q' })) out.push(c)
    const done = out.filter((c) => c.type === 'done')
    assert.equal(done.length, 1, '应恰好一个 done')
    assert.deepEqual((done[0] as { data: unknown }).data, { iterations: 7, duration: 999 })
  })

  test('query 抛错时产出 error chunk 而非抛出', async () => {
    const engine = {
      async query() {
        throw new Error('网络失败')
      },
    } as unknown as never
    const out: QueryChunk[] = []
    for await (const c of createQueryGenerator(engine, { query: 'q' })) out.push(c)
    assert.equal(out.length, 1)
    assert.equal(out[0].type, 'error')
    assert.equal((out[0] as { data: { message: string } }).data.message, '网络失败')
  })

  test('onChunk 回调收到每个 chunk', async () => {
    const engine = fakeEngine([
      { type: 'response_chunk', content: 'a' },
      { type: 'response_chunk', content: 'b' },
    ])
    const seen: string[] = []
    for await (const _c of createQueryGenerator(engine as never, {
      query: 'q',
      options: { onChunk: (c) => seen.push(c.type) },
    })) { /* drain */ }
    assert.equal(seen.filter((t) => t === 'message').length, 2, 'onChunk 应收到两条 message')
  })
})

describe('createQueryGenerator — 流式语义（回归）', () => {
  test('中间 chunk 应被逐个 yield 出去，而非只给最后一个 done', async () => {
    const engine = fakeEngine([
      { type: 'response_chunk', content: '第一段' },
      { type: 'response_chunk', content: '第二段' },
    ])
    const out: QueryChunk[] = []
    for await (const c of createQueryGenerator(engine as never, { query: 'q' })) out.push(c)

    const messages = out.filter((c) => c.type === 'message')
    assert.equal(
      messages.length,
      2,
      `流式生成器应把中间 chunk 逐个产出，实际拿到 ${out.length} 个（messages=${messages.length}）`,
    )
  })

  test('事件顺序应保持（chunk 不得乱序）', async () => {
    const engine = fakeEngine([
      { type: 'response_chunk', content: 'x' },
      { type: 'tool_call_start', toolUseId: 't1', toolName: 'ls', input: {} },
      { type: 'tool_result', toolUseId: 't1', content: 'ok' },
      { type: 'response_chunk', content: 'y' },
    ])
    const out: QueryChunk[] = []
    for await (const c of createQueryGenerator(engine as never, { query: 'q' })) out.push(c)
    const types = out.filter((c) => c.type !== 'done').map((c) => c.type)
    assert.deepEqual(types, ['message', 'tool_use', 'tool_result', 'message'], '事件顺序必须保持')
  })
})
