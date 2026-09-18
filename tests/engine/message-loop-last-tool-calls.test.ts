/**
 * MessageLoop lastToolCalls 修复回归测试
 *
 * 背景（2026-09-18 审查发现的死功能）：`lastToolCalls` 字段在 MessageLoop 里
 * 被定义、且在 `_recordAssistantResponse` 里用于判断「模型 read/search 后是否
 * 提前终止」以触发 autoContinue.readSearch。但全文**从未有赋值** ——
 * 它永远是 `[]`，导致 readSearch 分支恒不触发（死功能）。
 *
 * 修复：工具执行成功后把本轮实际执行的工具名填进 `lastToolCalls`
 * （`messageLoop.ts` 的 `addToolResults` 之后）。
 *
 * 锁定：模型发起 `read` 工具、执行成功后，下一轮若无工具调用、正文也没有
 * 「继续」类关键词，应被 autoContinue.readSearch 识别并自动续写（再跑一轮），
 * 而不是停在 read 结果上——这正是该字段被填充后的可见行为。
 *
 * 运行：node --import tsx --test tests/engine/message-loop-last-tool-calls.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { MessageLoop, type MessageLoopDeps } from '../../src/engine/messageLoop.ts'

/**
 * 造一个会在「第 n 轮」返回给定响应的 deps。responseHandler.handle 消费完本轮
 * 响应后推进 round，使下一轮返回下一轮的内容（模拟真实的多轮交互）。
 */
function makeDeps(rounds: Array<{ content: string; toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> }>) {
  const messages: Array<{ role: string; content: unknown }> = []
  const usedToolNames: string[][] = []
  let round = 0

  const deps = {
    stateMachine: {
      state: 'idle',
      canContinue: () => round < rounds.length,
      isTerminal: () => false,
      transition: async (to: string) => {
        deps.stateMachine.state = to
      },
    },
    tokenBudget: {
      setToolDefinitions: () => {},
      checkBudget: () => ({ usedTokens: 0, shouldCompact: false, shouldReject: false }),
      getUsage: () => ({ inputTokens: 0, outputTokens: 0 }),
    },
    requestBuilder: { build: () => ({}) },
    responseHandler: {
      set allowedToolNames(_: unknown) {},
      onReasoning: undefined,
      onChunk: undefined,
      handle: async () => {
        const r = rounds[Math.min(round, rounds.length - 1)]
        // 消费完本轮响应后推进轮次，让下一轮返回下一轮的内容
        round++
        return {
          content: r.content,
          toolCalls: r.toolCalls,
          stopReason: r.toolCalls.length > 0 ? 'tool_use' : 'end_turn',
          needsUserInput: false,
        }
      },
    },
    toolScheduler: {
      execute: async (calls: Array<{ id: string; name: string }>) => {
        usedToolNames.push(calls.map((c) => c.name))
        return calls.map((c) => ({ toolUseId: c.id, success: true, output: `result of ${c.name}` }))
      },
    },
    apiClient: {
      sendMessage: async () => {
        return {
          async *[Symbol.asyncIterator]() {
            yield { type: 'text', text: '' }
          },
        }
      },
    },
    conversation: {
      messages,
      addToolResults: (results: unknown[]) => {
        for (const r of results as Array<{ toolUseId: string; output: string }>) {
          messages.push({ role: 'tool', content: r.output })
        }
      },
    },
    systemPrompt: '',
    model: 'test-model',
    maxOutputTokens: 1024,
    toolDefinitions: [{ name: 'read', description: 'read a file', input_schema: { type: 'object' } }],
    provider: 'anthropic',
    autoContinue: { enabled: true, readSearch: true, maxCount: 5 },
  } as unknown as MessageLoopDeps

  return { deps, usedToolNames }
}

describe('MessageLoop lastToolCalls 填充（readSearch 自动续写）', () => {
  test('模型 read 后无「继续」关键词，仍被自动续写一轮（字段已填充）', async () => {
    // 第 0 轮：模型发起 read 工具；第 1 轮：模型给出无继续词的正文
    const { deps, usedToolNames } = makeDeps([
      { content: '', toolCalls: [{ id: 't1', name: 'read', input: { path: 'x' } }] },
      { content: '文件内容已读取，无需继续。', toolCalls: [] },
    ])

    const loop = new MessageLoop(deps)
    const result = await loop.run('读文件 x')

    // 关键：read 被真正执行了
    assert.deepEqual(usedToolNames[0], ['read'], '第一轮应执行 read 工具')

    // 因为 lastToolCalls 被填充为 [{name:'read'}]（修复前永为 []），readSearch 分支命中，
    // 第二轮（无工具、无继续词）会触发 autoContinue 续写 —— 所以会跑到第 2 轮。
    // 修复前 lastToolCalls 恒为空 → hadReadOrSearch 恒 false → 不会续写 → iterations 恒为 1。
    // （注：readSearch 续写成功后 _recordAssistantResponse 会主动清空 lastToolCalls，
    // 故不在此断言其最终值；用「迭代轮数 >= 2」即可锁定修复。）
    assert.ok(result.iterations >= 2, 'read 后 should 被自动续写，迭代应 >= 2（修复前恒为 1）')
  })

  test('无工具调用的轮次不污染 lastToolCalls', async () => {
    const { deps } = makeDeps([
      { content: '直接回答', toolCalls: [] },
      { content: '结束', toolCalls: [] },
    ])
    const loop = new MessageLoop(deps)
    await loop.run('问个问题')
    const last = (loop as unknown as { lastToolCalls: Array<{ name: string }> }).lastToolCalls
    assert.deepEqual(last, [], '没有任何工具执行时 lastToolCalls 应为空')
  })

  test('单轮工具执行后 lastToolCalls 被填充（无 readSearch 续写清空）', async () => {
    // 只给一轮：模型发起 read 工具，执行后 done（canContinue 不再允许下一轮）。
    // 此时没有 readSearch 续写分支来清空它，run 返回后 lastToolCalls 应保留 [{read}]。
    const { deps, usedToolNames } = makeDeps([
      { content: '', toolCalls: [{ id: 't1', name: 'read', input: { path: 'x' } }] },
    ])
    const loop = new MessageLoop(deps)
    await loop.run('读文件')
    assert.deepEqual(usedToolNames[0], ['read'], '应执行 read 工具')
    const last = (loop as unknown as { lastToolCalls: Array<{ name: string }> }).lastToolCalls
    assert.deepEqual(last, [{ name: 'read' }], '工具执行后 lastToolCalls 应被填充')
  })
})
