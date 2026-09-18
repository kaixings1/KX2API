/**
 * engine/tools 测试（presets / baseToolsFilter / initDepth）
 *
 * 含真实缺陷回归：
 *   getToolsForPreset 依赖 preset.denyRules，但 TOOL_PRESETS 里没有任何预设
 *   定义 denyRules（只有 tags）→ 该函数恒返回全部工具，"按预设筛选"形同虚设。
 *
 * 运行：node --import tsx --test tests/engine/tools-presets.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { TOOL_PRESETS, parseToolPreset } from '../../src/engine/tools/presets.ts'
import {
  BASE_TOOL_NAMES,
  getAllBaseTools,
  filterToolsByDenyRules,
  getToolsForPreset,
} from '../../src/engine/tools/baseToolsFilter.ts'
import { getToolInitDepth, _markToolInitStart, _markToolInitEnd, withInitDepth } from '../../src/engine/tools/initDepth.ts'
import type { Tool } from '../../src/engine/toolScheduler.ts'

function tool(name: string, tags?: string[]): Tool {
  return {
    name,
    description: `${name} desc`,
    parameters: {},
    tags,
    validate: () => ({ valid: true }),
    execute: async () => ({ content: '' }),
  } as unknown as Tool
}

describe('presets', () => {
  test('四个预设齐备且结构完整', () => {
    for (const id of ['default', 'programming', 'search', 'minimal'] as const) {
      const p = TOOL_PRESETS[id]
      assert.ok(p, `${id} 预设应存在`)
      assert.equal(p.id, id)
      assert.ok(p.name && p.description)
      assert.ok(Array.isArray(p.tags) && p.tags.length > 0)
    }
  })

  test('parseToolPreset 支持 id 与名称（大小写不敏感）', () => {
    assert.equal(parseToolPreset('default')!.id, 'default')
    assert.equal(parseToolPreset('Minimal')!.id, 'minimal')
    assert.equal(parseToolPreset('PROGRAMMING')!.id, 'programming')
    assert.equal(parseToolPreset('search')!.id, 'search')
  })

  test('parseToolPreset 未知输入返回 null', () => {
    assert.equal(parseToolPreset('不存在'), null)
    assert.equal(parseToolPreset(''), null)
  })

  test('parseToolPreset 不得返回可被外部篡改的共享引用（回归）', () => {
    const a = parseToolPreset('minimal')!
    a.tags.push('被污染的标签')
    const b = parseToolPreset('minimal')!
    assert.equal(
      b.tags.includes('被污染的标签'),
      false,
      '预设是全局常量，返回值必须是副本',
    )
  })
})

describe('baseToolsFilter', () => {
  test('BASE_TOOL_NAMES 非空且无重复', () => {
    assert.ok(BASE_TOOL_NAMES.length > 0)
    assert.equal(new Set(BASE_TOOL_NAMES).size, BASE_TOOL_NAMES.length)
  })

  test('getAllBaseTools 只保留名单内的工具', () => {
    const tools = [tool('Read'), tool('Write'), tool('自定义工具')]
    const got = getAllBaseTools(tools)
    assert.deepEqual(got.map((t) => t.name), ['Read', 'Write'])
  })

  test('空规则时原样返回', () => {
    const tools = [tool('Read')]
    assert.equal(filterToolsByDenyRules(tools, []), tools)
  })

  test('按工具名 deny', () => {
    const tools = [tool('Read'), tool('Bash')]
    const got = filterToolsByDenyRules(tools, [{ tool: 'Bash' }])
    assert.deepEqual(got.map((t) => t.name), ['Read'])
  })

  test('按 tag deny', () => {
    const tools = [tool('A', ['net']), tool('B', ['fs'])]
    const got = filterToolsByDenyRules(tools, [{ tag: 'net' }])
    assert.deepEqual(got.map((t) => t.name), ['B'])
  })

  test('getToolsForPreset 应真正按预设筛选（回归：预设无 denyRules 恒不筛）', () => {
    const tools = [tool('Read', ['read']), tool('Bash', ['bash']), tool('WebSearch', ['web'])]
    const minimal = getToolsForPreset(tools, 'minimal')
    assert.ok(
      minimal.length < tools.length,
      `minimal 预设应筛掉部分工具，实际返回 ${minimal.length}/${tools.length}`,
    )
  })
})

describe('initDepth', () => {
  test('初始深度为 0', () => {
    assert.equal(getToolInitDepth(), 0)
  })

  test('手动增减', () => {
    _markToolInitStart()
    assert.equal(getToolInitDepth(), 1)
    _markToolInitEnd()
    assert.equal(getToolInitDepth(), 0)
  })

  test('多余减少不会变负', () => {
    _markToolInitEnd()
    _markToolInitEnd()
    assert.equal(getToolInitDepth(), 0)
  })

  test('withInitDepth 进入/退出后恢复原深度', async () => {
    const r = await withInitDepth(async () => {
      assert.equal(getToolInitDepth(), 1)
      return 'done'
    })
    assert.equal(r, 'done')
    assert.equal(getToolInitDepth(), 0)
  })

  test('withInitDepth 内抛错也恢复深度', async () => {
    await assert.rejects(() => withInitDepth(async () => { throw new Error('boom') }))
    assert.equal(getToolInitDepth(), 0, 'finally 必须回收深度')
  })
})
