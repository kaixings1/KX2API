/**
 * 纯文本工具调用白名单化测试
 *
 * 守的是历史回归：模型最终答复里含接口文档/HTML 示例时，
 * 宽松的 XML 扫描会把正文当工具调用剥离，导致用户看到空白答复。
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  isPlausibleToolName,
  isAllowedToolName,
  parsePlainTextToolCalls,
  extractPlainTextToolCalls,
  stripPlainTextToolCalls,
} from '../../src/utils/plainTextToolCallRepair.ts'

const TOOLS = new Set(['ls', 'cat', 'read_file', 'bash', 'grep'])

describe('isPlausibleToolName — 形状校验（保持原语义）', () => {
  test('合法命令标识符通过', () => {
    for (const n of ['ls', 'read_file', 'git-status', 'mcp.fs.read', 'a/b']) {
      assert.ok(isPlausibleToolName(n), n)
    }
  })

  test('中文 / 空格 / 纯数字 / 空串被拒', () => {
    for (const n of ['用户', 'get user', '12345', '', '   ', '<b>x</b>']) {
      assert.ok(!isPlausibleToolName(n), n)
    }
  })
})

describe('isAllowedToolName — 白名单校验', () => {
  test('未提供白名单时退回形状校验（向后兼容）', () => {
    assert.ok(isAllowedToolName('anything_like_cmd', null))
    assert.ok(isAllowedToolName('anything_like_cmd', undefined))
    assert.ok(!isAllowedToolName('ls', new Set()), '空集表示本轮无工具可用，应拒绝一切')
    assert.ok(!isAllowedToolName('anything_like_cmd', new Set()))
    assert.ok(!isAllowedToolName('用户', null), '形状校验仍需通过')
  })

  test('有白名单时只放行命中项', () => {
    assert.ok(isAllowedToolName('ls', TOOLS))
    assert.ok(!isAllowedToolName('get_user', TOOLS), '形状合法但不在工具集内 → 拒绝')
  })

  test('大小写差异被容忍', () => {
    assert.ok(isAllowedToolName('LS', TOOLS))
  })
})

describe('白名单拦截「文档示例被误判为工具调用」', () => {
  const docText = [
    '接口返回结构如下：',
    '',
    '<response>',
    '  <name>get_user</name>',
    '  <arguments>{"id": 1}</arguments>',
    '</response>',
    '',
    '以上是服务端约定的字段说明。',
  ].join('\n')

  test('无白名单时会被误判（复现历史 bug 的前提）', () => {
    const blocks = extractPlainTextToolCalls(docText)
    assert.ok(blocks.length > 0, '形状校验挡不住 get_user 这类文档示例')
  })

  test('有白名单时不再误判', () => {
    const blocks = extractPlainTextToolCalls(docText, TOOLS)
    assert.equal(blocks.length, 0, 'get_user 不在工具集内，不应被识别')
  })

  test('有白名单时正文不被剥离', () => {
    const stripped = stripPlainTextToolCalls(docText, TOOLS)
    assert.ok(stripped.includes('get_user'), '文档示例必须原样保留')
    assert.ok(stripped.includes('服务端约定的字段说明'))
  })

  test('无白名单时正文会被剥离（说明白名单是必需的）', () => {
    const stripped = stripPlainTextToolCalls(docText)
    assert.ok(!stripped.includes('get_user'), '无白名单时会被剥离 —— 这正是要修的问题')
  })
})

describe('白名单放行真实工具调用', () => {
  test('名单内的真实调用仍被识别', () => {
    const realCall = '<tool_call><name>ls</name><arguments>{"path":"."}</arguments></tool_call>'
    const blocks = extractPlainTextToolCalls(realCall, TOOLS)
    assert.equal(blocks.length, 1)
    assert.equal(blocks[0].name, 'ls')
  })

  test('名单内的真实调用仍被剥离（正文只剩说明文字）', () => {
    const mixed = '我先看下目录：\n\n<tool_call><name>ls</name><arguments>{"path":"."}</arguments></tool_call>\n\n然后继续。'
    const stripped = stripPlainTextToolCalls(mixed, TOOLS)
    assert.ok(stripped.includes('我先看下目录'))
    assert.ok(stripped.includes('然后继续'))
    assert.ok(!stripped.includes('<tool_call>'), '工具块应被剥离')
  })

  test('扁平 XML 形态（toolName + arguments）同样受白名单约束', () => {
    const real = '<toolName>cat</toolName><arguments>{"path":"a.txt"}</arguments>'
    assert.equal(extractPlainTextToolCalls(real, TOOLS).length, 1)

    const fake = '<toolName>fetch_url</toolName><arguments>{"url":"x"}</arguments>'
    assert.equal(extractPlainTextToolCalls(fake, TOOLS).length, 0)
  })

  test('代码围栏内的 JSON 调用受白名单约束', () => {
    const fenced = '```json\n{"name": "ls", "arguments": {"path": "."}}\n```'
    assert.ok(extractPlainTextToolCalls(fenced, TOOLS).length >= 1)

    const fencedFake = '```json\n{"name": "deploy_prod", "arguments": {}}\n```'
    assert.equal(extractPlainTextToolCalls(fencedFake, TOOLS).length, 0)
  })
})

describe('parsePlainTextToolCalls 全消耗语义 + 白名单', () => {
  test('整段是名单内工具调用 → 返回结果', () => {
    const only = '<tool_call><name>ls</name><arguments>{"path":"."}</arguments></tool_call>'
    const r = parsePlainTextToolCalls(only, TOOLS)
    assert.ok(r && r.length === 1)
  })

  test('整段是名单外调用 → 返回空（不触发正文清空）', () => {
    const only = '<tool_call><name>destroy_all</name><arguments>{}</arguments></tool_call>'
    assert.equal(parsePlainTextToolCalls(only, TOOLS), null)
  })

  test('空工具集时一切都不认', () => {
    const only = '<tool_call><name>ls</name><arguments>{"path":"."}</arguments></tool_call>'
    assert.equal(parsePlainTextToolCalls(only, new Set()), null)
  })
})

describe('正文保护（历史回归防线）', () => {
  test('含 HTML/XML 示例的答复不会被剥离', () => {
    const answer = [
      '根据 `<config>` 的定义：',
      '',
      '```xml',
      '<config>',
      '  <name>数据库连接</name>',
      '  <arguments>host=localhost</arguments>',
      '</config>',
      '```',
      '',
      '所以你需要这样配置。',
    ].join('\n')
    const stripped = stripPlainTextToolCalls(answer, TOOLS)
    assert.ok(stripped.includes('数据库连接'), '示例内容必须保留')
    assert.ok(stripped.includes('所以你需要这样配置'))
  })

  test('正文里的普通中文 name 标签不受影响', () => {
    const text = '<response><name>用户</name></response>'
    const stripped = stripPlainTextToolCalls(text, TOOLS)
    assert.ok(stripped.includes('用户'))
  })
})
