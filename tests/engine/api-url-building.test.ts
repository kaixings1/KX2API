/**
 * API client URL 构建测试（离线，纯函数）
 *
 * 迁移说明：原位于 `tests/engine/legacy/`，但该目录被 `.gitignore` 的
 * `legacy/` 规则忽略，**不进版本库** —— 别人 clone 后这些测试根本不存在，
 * 本地与 CI 的测试集不一致。这里迁到受版本控制的 `tests/engine/` 下。
 *
 * 被测逻辑：baseUrl 是否应追加 `/v1/chat/completions`（或 `/v1/messages`）。
 * 关键case是「baseUrl 已含完整路径时不得重复追加」——重复追加会让请求
 * 打到 `/v1/chat/completions/v1/chat/completions`，表现为莫名的 404。
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// ---- URL 构建逻辑（与 src/engine/api/client.ts 中一致） ----

function buildOpenAIEndpoint(baseUrl: string): string {
  const raw = (baseUrl || 'https://api.openai.com').replace(/\/$/, '')
  const hasEndpoint = raw.includes('/chat/completions')
  return hasEndpoint ? raw : raw + '/v1/chat/completions'
}

function buildAnthropicEndpoint(baseUrl: string): string {
  const raw = (baseUrl || 'https://api.anthropic.com').replace(/\/$/, '')
  return raw + '/v1/messages'
}

describe('OpenAI 兼容端点构建', () => {
  test('默认 baseUrl 追加 /v1/chat/completions', () => {
    assert.equal(
      buildOpenAIEndpoint('https://api.openai.com'),
      'https://api.openai.com/v1/chat/completions',
    )
  })

  test('本地代理同样追加', () => {
    assert.equal(
      buildOpenAIEndpoint('http://127.0.0.1:8080'),
      'http://127.0.0.1:8080/v1/chat/completions',
    )
  })

  test('已含完整路径的不重复追加（stepfun step_plan）', () => {
    assert.equal(
      buildOpenAIEndpoint('https://api.stepfun.com/step_plan/v1/chat/completions'),
      'https://api.stepfun.com/step_plan/v1/chat/completions',
    )
  })

  test('已含完整路径的不重复追加（modelscope）', () => {
    assert.equal(
      buildOpenAIEndpoint('https://api-inference.modelscope.cn/v1/chat/completions'),
      'https://api-inference.modelscope.cn/v1/chat/completions',
    )
  })

  test('已含完整路径的不重复追加（bigmodel）', () => {
    assert.equal(
      buildOpenAIEndpoint('https://open.bigmodel.cn/api/paas/v4/chat/completions'),
      'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    )
  })

  test('尾斜杠被剥离', () => {
    assert.equal(
      buildOpenAIEndpoint('https://api.openai.com/'),
      'https://api.openai.com/v1/chat/completions',
    )
    assert.equal(
      buildOpenAIEndpoint('https://api.stepfun.com/step_plan/v1/chat/completions/'),
      'https://api.stepfun.com/step_plan/v1/chat/completions',
    )
  })

  test('空 baseUrl 回落默认值', () => {
    assert.equal(buildOpenAIEndpoint(''), 'https://api.openai.com/v1/chat/completions')
  })
})

describe('Anthropic 端点构建', () => {
  test('默认追加 /v1/messages', () => {
    assert.equal(
      buildAnthropicEndpoint('https://api.anthropic.com'),
      'https://api.anthropic.com/v1/messages',
    )
  })

  test('本地代理同样追加', () => {
    assert.equal(
      buildAnthropicEndpoint('http://127.0.0.1:8080'),
      'http://127.0.0.1:8080/v1/messages',
    )
  })
})
