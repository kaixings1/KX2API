/**
 * tests/fixtures/llm-responses.ts — LLM API 响应的 mock 测试数据
 *
 * 用途：让涉及「调用模型」的测试**离线可跑**——不依赖网络、不消耗真实额度、
 * 结果稳定可复现，也不需要任何 API Key。
 *
 * 为什么要集中放这里：此前多个测试各自内联构造响应体，字段不一致
 * （有的缺 `usage`、有的 id 格式不同），导致"改了一处漏掉另一处"。
 * 统一到本文件后，字段形状有唯一事实来源。
 *
 * ⚠️ 这些是**替身数据**，不是真实响应样本；若上游协议变更，需要同步更新。
 */

/** OpenAI 兼容的非流式响应体 */
export function openAICompletion(overrides: {
  content?: string
  model?: string
  finishReason?: string
  promptTokens?: number
  completionTokens?: number
} = {}) {
  const {
    content = '你好，这是一条 mock 回复。',
    model = 'mock-model',
    finishReason = 'stop',
    promptTokens = 12,
    completionTokens = 8,
  } = overrides

  return {
    id: 'chatcmpl-mock-0001',
    object: 'chat.completion',
    created: 1735689600, // 固定时间戳：让快照/断言可复现
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: finishReason,
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  }
}

/** OpenAI 兼容的流式分片（用于逐条喂给 SSE 解析器） */
export function openAIStreamChunks(text = '你好'): string[] {
  // 逐字符切分，模拟真实流式的 delta 累积行为
  return [...text].map(
    (ch, i) =>
      `data: ${JSON.stringify({
        id: 'chatcmpl-mock-0001',
        object: 'chat.completion.chunk',
        created: 1735689600,
        model: 'mock-model',
        choices: [{ index: 0, delta: i === 0 ? { role: 'assistant', content: ch } : { content: ch }, finish_reason: null }],
      })}\n\n`,
  )
}

/** 流结束标记 */
export const SSE_DONE = 'data: [DONE]\n\n'

/** Anthropic Messages API 的非流式响应体 */
export function anthropicMessage(overrides: { text?: string; model?: string } = {}) {
  const { text = '你好，这是一条 mock 回复。', model = 'mock-model' } = overrides
  return {
    id: 'msg_mock_0001',
    type: 'message',
    role: 'assistant',
    model,
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 12, output_tokens: 8 },
  }
}

/** 认证失败响应（401）——用于测试不做真实请求就能验证错误分支 */
export function unauthorizedResponse(message = 'Invalid API key') {
  return {
    error: {
      message,
      type: 'invalid_request_error',
      code: 'invalid_api_key',
    },
  }
}

/**
 * 占位 API Key。
 *
 * 测试里**绝不要写真实 Key**：一旦写进源码就会进入 git 历史，
 * 即便事后删除也已被 clone/fork 留存（本项目历史上有过真实 Key 泄漏事故）。
 * 需要 Key 参与的逻辑（如 header 拼装）用本常量即可，形状对得上但不具备任何权限。
 */
export const FAKE_API_KEY = 'sk-test-000000000000000000000000000000000000000000000000'
