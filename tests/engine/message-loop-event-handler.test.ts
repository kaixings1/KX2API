/**
 * MessageLoop 事件发射器的两条行为约束
 *
 * 背景（2026-09-17 实测 bug）：界面「一直不显示，并且不停止」，只能手动点中断。
 * 根因：QueryEngine.setLoopEventHandler() 会在每次 query() 前**事后替换**
 * deps.onEvent，而 MessageLoop 曾在构造期把回调快照进 this.emit —— 替换后新
 * handler 永远收不到事件，`done` 发不到渲染层，界面就一直转圈。
 *
 * 这两条用例锁定「必须动态读取 deps.onEvent，不能在构造期快照」。
 *
 * 运行：node --import tsx --test tests/engine/message-loop-event-handler.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { MessageLoop, type MessageLoopDeps } from '../../src/engine/messageLoop.ts'

/** 构造最小可用的 deps：只让 run() 走到「发事件然后返回」所需的部分 */
function makeDeps() {
  const messages: Array<{ role: string; content: string }> = []
  const stateMachine = {
    state: 'idle',
    canContinue: () => false,
    isTerminal: () => true,
    transition: async (to: string) => {
      stateMachine.state = to
    },
  }
  const deps = {
    stateMachine,
    tokenBudget: {
      setToolDefinitions: () => {},
      checkBudget: () => ({ usedTokens: 0, shouldCompact: false, shouldReject: false }),
      getUsage: () => ({ inputTokens: 0, outputTokens: 0 }),
    },
    requestBuilder: { build: () => ({}) },
    responseHandler: { process: async () => ({ content: '', toolCalls: [] }) },
    toolScheduler: { execute: async () => [] },
    apiClient: { sendMessage: async () => ({}) },
    conversation: { messages, addToolResults: () => {} },
    systemPrompt: '',
    model: 'test-model',
    maxOutputTokens: 1024,
    toolDefinitions: [],
    provider: 'anthropic',
  }
  return deps as unknown as MessageLoopDeps
}

describe('MessageLoop 事件发射器', () => {
  test('构造期没有 onEvent，事后挂上的 handler 也能收到事件', async () => {
    const deps = makeDeps()
    const loop = new MessageLoop(deps)

    // 模拟 QueryEngine.setLoopEventHandler()：构造**之后**才挂上 handler
    const received: string[] = []
    ;(loop as unknown as { deps: MessageLoopDeps }).deps.onEvent = (e: { type: string }) => {
      received.push(e.type)
    }

    await loop.run('你好')

    assert.ok(received.includes('iteration_start'), '应收到 iteration_start')
    assert.ok(received.includes('done'), '应收到 done —— 否则界面永远不停止')
  })

  test('运行途中替换 handler，后续事件走新 handler', async () => {
    const deps = makeDeps()
    const loop = new MessageLoop(deps)

    const first: string[] = []
    const second: string[] = []
    deps.onEvent = ((e: { type: string }) => {
      first.push(e.type)
    }) as MessageLoopDeps['onEvent']

    await loop.run('第一次')
    assert.ok(first.length > 0, '第一个 handler 应收到事件')

    // 换成第二个 handler 再跑一次
    ;(loop as unknown as { deps: MessageLoopDeps }).deps.onEvent = ((e: { type: string }) => {
      second.push(e.type)
    }) as MessageLoopDeps['onEvent']

    await loop.run('第二次')

    assert.ok(second.includes('iteration_start'), '新 handler 应收到 iteration_start')
    assert.ok(second.includes('done'), '新 handler 应收到 done')
  })
})
