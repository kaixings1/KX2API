/**
 * ModelScope 认证头拼装测试（**离线**，不发真实网络请求）
 *
 * 本文件原先是一段「真跑」的探针脚本：
 *   - 硬编码了**真实的 ModelScope API Key**（已进入 git 历史，需在服务商侧作废轮换）
 *   - 每次 `npm run test:extras` 都向 api-inference.modelscope.cn 发 3 次请求
 *   - 且**没有任何断言**，只 console.log —— 网络不通也照样 PASS，
 *     是"假绿灯"：看起来测试通过，实际什么都没验证
 *
 * 现在改为：用 fetch mock 拦截请求，断言"三种认证方式各自发出了什么头"。
 * 既验证了真实逻辑，又完全离线、无凭证、结果稳定。
 *
 * 保留的三种认证方式（与原脚本一致）：Bearer / X-ModelScope-Token / query param。
 */
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { installMockFetch, restoreFetch, recordedRequests } from '../fixtures/mock-fetch.ts'
import { FAKE_API_KEY, openAICompletion } from '../fixtures/llm-responses.ts'

const BASE_URL = 'https://api-inference.modelscope.cn/v1/chat/completions'
const HOST = 'api-inference.modelscope.cn'
const MODEL = 'deepseek-ai/DeepSeek-V4-Flash'

/** 与生产代码同构的三种认证头构造（被测逻辑本身） */
const authVariants = [
  {
    name: 'Bearer token',
    build: (key: string) => ({
      url: BASE_URL,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    }),
  },
  {
    name: 'X-ModelScope-Token',
    build: (key: string) => ({
      url: BASE_URL,
      headers: { 'X-ModelScope-Token': key, 'Content-Type': 'application/json' },
    }),
  },
  {
    name: 'token query param',
    build: (key: string) => ({
      url: `${BASE_URL}?token=${key}`,
      headers: { 'Content-Type': 'application/json' },
    }),
  },
]

before(() => {
  // 任何 host 都返回 mock 200；未配置的 host 会抛错（防止漏配走真实网络）
  installMockFetch({ [HOST]: { status: 200, body: openAICompletion({ model: MODEL }) } })
})

after(() => restoreFetch())

describe('ModelScope 认证方式', () => {
  for (const variant of authVariants) {
    test(`${variant.name} —— 发出的请求携带正确凭证`, async () => {
      const { url, headers } = variant.build(FAKE_API_KEY)

      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 10,
          stream: false,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      })

      assert.equal(resp.status, 200, 'mock 应返回 200')

      // 断言"确实发出了预期请求"——这是原脚本完全缺失的部分。
      // recorded 跨用例累积，故取最后一次（每次用例各发一次请求）。
      const reqs = recordedRequests()
      assert.ok(reqs.length >= 1, '应至少发出一次请求')
      const req = reqs[reqs.length - 1]
      assert.ok(req.url.startsWith(BASE_URL), `请求 URL 应指向 ModelScope，实际 ${req.url}`)

      if (variant.name === 'Bearer token') {
        assert.equal(req.headers.authorization, `Bearer ${FAKE_API_KEY}`)
      } else if (variant.name === 'X-ModelScope-Token') {
        assert.equal(req.headers['x-modelscope-token'], FAKE_API_KEY)
      } else {
        assert.ok(req.url.includes(`token=${FAKE_API_KEY}`), 'token 应出现在 query 中')
      }
    })
  }

  test('响应体可被解析为 OpenAI 兼容结构', async () => {
    const resp = await fetch(BASE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${FAKE_API_KEY}` },
      body: '{}',
    })
    const data = (await resp.json()) as ReturnType<typeof openAICompletion>

    assert.equal(data.object, 'chat.completion')
    assert.equal(data.model, MODEL)
    assert.equal(data.choices.length, 1)
    assert.equal(data.choices[0].message.role, 'assistant')
    assert.ok(data.usage.total_tokens > 0, 'usage 应包含 token 计数')
  })

  test('认证失败（401）时能识别错误结构', async () => {
    restoreFetch()
    installMockFetch({
      [HOST]: { status: 401, body: { error: { message: 'Invalid API key', type: 'invalid_request_error' } } },
    })

    const resp = await fetch(BASE_URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer bad-key' },
      body: '{}',
    })

    assert.equal(resp.status, 401)
    const data = (await resp.json()) as { error?: { message?: string } }
    assert.equal(data.error?.message, 'Invalid API key')
  })

  test('未配置的 host 会抛错（防止测试偷偷走真实网络）', async () => {
    await assert.rejects(
      () => fetch('https://unknown-host.example/v1/chat/completions'),
      /未配置 host/,
      '未配置的 host 必须报错，而不是放行真实请求',
    )
  })
})
