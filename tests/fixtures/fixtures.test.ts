/**
 * mock 基础设施自测 —— 确保替身本身可用。
 *
 * 为什么要测：如果 fixtures 有 bug（比如路由不生效、Response 构造失败），
 * 依赖它的测试会以难懂的方式失败（"测试通过但它其实没验证任何东西"），
 * 这比直接报错更危险。这里锁住基础设施的核心契约。
 */
import { test, describe, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { installMockFetch, restoreFetch, recordedRequests } from './mock-fetch.ts'
import {
  openAICompletion,
  openAIStreamChunks,
  anthropicMessage,
  unauthorizedResponse,
  FAKE_API_KEY,
  SSE_DONE,
} from './llm-responses.ts'

afterEach(() => restoreFetch())

describe('llm-responses fixtures', () => {
  test('OpenAI 响应形状完整（含 usage 与 finish_reason）', () => {
    const r = openAICompletion({ content: 'hi', model: 'm1' })
    assert.equal(r.object, 'chat.completion')
    assert.equal(r.model, 'm1')
    assert.equal(r.choices[0].message.content, 'hi')
    assert.equal(r.choices[0].finish_reason, 'stop')
    assert.equal(r.usage.total_tokens, r.usage.prompt_tokens + r.usage.completion_tokens)
  })

  test('流式分片拼接后是完整 SSE 文本且以 [DONE] 结束', () => {
    const chunks = openAIStreamChunks('你好')
    const all = chunks.join('') + SSE_DONE
    assert.ok(all.endsWith('data: [DONE]\n\n'))
    // 每个分片都能独立解析成 JSON（且第一个带 role）
    const first = JSON.parse(chunks[0].replace('data: ', '').trim())
    assert.equal(first.choices[0].delta.role, 'assistant')
    // 累积起来等于原文
    const text = chunks
      .map(c => JSON.parse(c.replace('data: ', '').trim()).choices[0].delta.content)
      .join('')
    assert.equal(text, '你好')
  })

  test('Anthropic 响应含 content 数组与 usage', () => {
    const r = anthropicMessage({ text: 'hi' })
    assert.equal(r.type, 'message')
    assert.equal(r.content[0].type, 'text')
    assert.ok(r.usage.input_tokens > 0)
  })

  test('401 错误体带 code 字段', () => {
    const e = unauthorizedResponse()
    assert.equal(e.error.code, 'invalid_api_key')
  })

  test('占位 Key 是明显的假值（防止有人误当成真 Key）', () => {
    assert.ok(FAKE_API_KEY.startsWith('sk-test-'), '占位 Key 必须带可识别的测试前缀')
    // 形状要像真 key（否则测不出 header 拼装逻辑）
    assert.ok(FAKE_API_KEY.length > 20)
  })
})

describe('mock-fetch', () => {
  test('按 host 路由返回对应响应', async () => {
    installMockFetch({ 'a.test': { status: 200, body: { hello: 'a' } } })
    const r = await fetch('https://a.test/x')
    assert.equal(r.status, 200)
    assert.deepEqual(await r.json(), { hello: 'a' })
  })

  test('未配置的 host 抛错而非放行真实网络', async () => {
    installMockFetch({ 'a.test': { body: {} } })
    await assert.rejects(
      () => fetch('https://b.test/x'),
      /未配置 host/,
      '这正是 mock-fetch 存在的核心理由：宁可报错也不要偷偷请求外网',
    )
  })

  test('记录请求的方法/头/体供断言', async () => {
    installMockFetch({ 'a.test': { body: {} } })
    await fetch('https://a.test/x', {
      method: 'POST',
      headers: { 'X-Custom': 'v1' },
      body: '{"q":1}',
    })
    const reqs = recordedRequests()
    assert.equal(reqs.length, 1)
    assert.equal(reqs[0].method, 'POST')
    assert.equal(reqs[0].headers['x-custom'], 'v1')
    assert.equal(reqs[0].body, '{"q":1}')
  })

  test('支持函数式路由（按 URL 动态返回）', async () => {
    installMockFetch({
      'a.test': (url: string) => (url.includes('fail') ? { status: 500, body: { e: 1 } } : { status: 200, body: { ok: 1 } }),
    })
    const ok = await fetch('https://a.test/ok')
    const bad = await fetch('https://a.test/fail')
    assert.equal(ok.status, 200)
    assert.equal(bad.status, 500)
  })

  test('restoreFetch 后记录被清空且真实 fetch 恢复', async () => {
    const before = globalThis.fetch
    installMockFetch({ 'a.test': { body: {} } })
    await fetch('https://a.test/x')
    assert.equal(recordedRequests().length, 1)
    restoreFetch()
    assert.equal(recordedRequests().length, 0)
    assert.equal(globalThis.fetch, before, 'restore 必须还原原始 fetch')
  })
})
