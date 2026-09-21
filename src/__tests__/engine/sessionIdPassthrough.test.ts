/**
 * sessionId 贯通链路回归测试
 *
 * 背景（修复前）：
 *   `MessageLoop` 有 `deps.sessionId`，但 `RequestParams` / `APIRequest` 都没有该字段，
 *   `requestBuilder.build()` 也不透传。于是：
 *     - `engine-bridge.createApiClientStream` 里 `request.sessionId` 恒为 undefined
 *       → `buildToolContext({sessionId: 'default'})`
 *     - `client.buildToolsFromRegistry()` 收不到 sessionId
 *       → `recordContext({sessionId: 'default'})`
 *   两条链路合起来 = 工具活跃集永远只有 'default' 一个 key，
 *   多会话并发时 `tool_load` 进来的工具会互相污染 / 互相"消失"。
 *
 * 本测试锁定的不变量：
 *   1. RequestParams 带 sessionId 时，build() 产出的 APIRequest 也带（且值一致）
 *   2. 不传 sessionId 时，APIRequest **不含该字段**（而不是补一个 'default'）
 *      —— 保持可选语义，避免下游把它当成"用户显式指定了 default"
 *   3. sessionId 是**进程内透传字段**，绝不能被当成 API 字段发出去
 *      （Anthropic / OpenAI 都不认识它，多传会被严格网关判 400）
 */
import { describe, it, expect } from 'vitest'
import { RequestBuilder } from '../../engine/requestBuilder.ts'

const baseParams = {
  messages: [{ role: 'user' as const, content: 'hi' }],
  system: 'sys',
  tools: [],
  model: 'gpt-4o',
  maxTokens: 128,
}

describe('sessionId 贯通 requestBuilder', () => {
  it('传入 sessionId 时透传到 APIRequest', async () => {
    const rb = new RequestBuilder()
    const req = await rb.build({ ...baseParams, provider: 'openai', sessionId: 'sess-42' })
    expect((req as { sessionId?: string }).sessionId).toBe('sess-42')
  })

  it('Anthropic 分支同样透传', async () => {
    const rb = new RequestBuilder()
    const req = await rb.build({ ...baseParams, provider: 'anthropic', sessionId: 'sess-a' })
    expect((req as { sessionId?: string }).sessionId).toBe('sess-a')
  })

  it('未传 sessionId 时输出不含该字段（不补 default）', async () => {
    const rb = new RequestBuilder()
    const req = await rb.build({ ...baseParams, provider: 'openai' })
    expect('sessionId' in req).toBe(false)
  })

  it('sessionId 不会被带进发给 API 的请求体字段', async () => {
    const rb = new RequestBuilder()
    const req = await rb.build({ ...baseParams, provider: 'openai', sessionId: 'sess-x' })

    // 它是内部字段：必须存在于返回值上供下游读取……
    expect((req as { sessionId?: string }).sessionId).toBe('sess-x')
    // ……但绝不能混进 extra（extra 会被 provider 适配器直接展开进请求体）
    expect(req.extra?.sessionId).toBeUndefined()
  })
})
