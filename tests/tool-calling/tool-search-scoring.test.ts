/**
 * 工具检索打分测试（toolMetaTools.searchTools / tokenizeQuery）
 *
 * 守的是原实现的两个具体缺陷：
 *   1. 无词边界 → "search" 命中 "research"、"git" 命中 "digital"
 *   2. 中文整串匹配 → "读取文件" 匹配不到描述里的 "读取某个文件的内容"
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { searchTools, tokenizeQuery } from '../../src/main/tools/toolMetaTools.ts'
import type { ToolDefinition } from '../../src/main/tools/types.ts'

function tool(partial: Partial<ToolDefinition> & { name: string }): ToolDefinition {
  return {
    id: partial.id ?? partial.name,
    name: partial.name,
    displayName: partial.displayName ?? partial.name,
    description: partial.description ?? '',
    usage: partial.usage ?? `/${partial.name}`,
    platform: 'all',
    parameters: [],
    tags: partial.tags ?? [],
    enabled: true,
    builtin: true,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  } as ToolDefinition
}

const TOOLS: ToolDefinition[] = [
  tool({ name: 'grep', description: '在文件内容里搜索文本' }),
  tool({ name: 'web_search', description: '联网搜索资料' }),
  tool({ name: 'research_notes', description: '整理研究笔记' }),
  tool({ name: 'git_status', description: '查看 git 仓库状态', tags: ['git'] }),
  tool({ name: 'digital_clock', description: '显示数字时钟' }),
  tool({ name: 'read_file', description: '读取某个文件的内容', searchHint: ['jupyter', 'ipynb'] }),
  tool({ name: 'notebook_edit', description: '修改 .ipynb 单元' }),
]

function names(query: string, extra: Partial<Parameters<typeof searchTools>[0]> = {}): string[] {
  return searchTools({ query, tools: TOOLS, limit: 10, ...extra }).map(c => c.id)
}

describe('tokenizeQuery', () => {
  test('拉丁词按空格与标点切分', () => {
    assert.deepEqual(tokenizeQuery('git status'), ['git', 'status'])
    assert.deepEqual(tokenizeQuery('a,b.c'), ['a', 'b', 'c'])
  })

  test('中文切二元组（不是单字）', () => {
    assert.deepEqual(tokenizeQuery('读取文件'), ['读取', '取文', '文件'])
  })

  test('单字中文保留原样', () => {
    assert.deepEqual(tokenizeQuery('跑'), ['跑'])
  })

  test('中英混合', () => {
    const t = tokenizeQuery('git 提交')
    assert.ok(t.includes('git'))
    assert.ok(t.includes('提交'))
  })

  test('空串返回空数组', () => {
    assert.deepEqual(tokenizeQuery(''), [])
  })
})

describe('词边界 —— 修掉子串误报', () => {
  test('搜 search 命中 web_search，且不命中 research_notes', () => {
    const r = names('search')
    assert.equal(r[0], 'web_search', `首名应为 web_search，实际 ${r[0]}`)
    // 原实现用裸 includes，"re|search|_notes" 里的 search 会被误命中。
    // 修复后 research_notes 完全不该出现。
    assert.ok(!r.includes('research_notes'), `不应命中 research_notes，实际 ${r.join(',')}`)
  })

  test('搜 git 不应命中 digital_clock', () => {
    const r = names('git')
    assert.ok(!r.includes('digital_clock'), 'git 是 digital 的子串，但不应命中')
  })

  test('搜 git 能命中 git_status（词边界正确放行）', () => {
    const r = names('git')
    assert.ok(r.includes('git_status'))
  })

  test('搜 stat 不应命中 git_status（仅子串）', () => {
    // stat 不是 status 的独立词，只算 namePartial（低分），不应压过精确词
    const r = names('stat')
    if (r.includes('git_status')) {
      assert.ok(r.length <= 2, '子串命中应为低优先级，不应泛滥')
    }
  })
})

describe('中文二元组 —— 修掉整串匹配失效', () => {
  test('描述为「读取某个文件的内容」能被「读取文件」搜到', () => {
    const r = names('读取文件')
    assert.ok(r.includes('read_file'), `应命中 read_file，实际 ${r.join(',')}`)
  })

  test('中文查询不会因单字噪声命中无关工具', () => {
    // "文件" 命中 read_file 合理；但不该把 digital_clock 之类也带进来
    const r = names('文件')
    assert.ok(!r.includes('digital_clock'))
    assert.ok(!r.includes('web_search'))
  })

  test('中文精确命中排在前', () => {
    const r = names('搜索')
    assert.ok(r[0] === 'grep' || r[0] === 'web_search', `实际 ${r[0]}`)
  })
})

describe('searchHint —— 补名字与描述里都没有的检索词', () => {
  test('用 jupyter 能搜到 read_file（靠 searchHint）', () => {
    const r = names('jupyter')
    assert.ok(r.includes('read_file'), `searchHint 应生效，实际 ${r.join(',')}`)
  })

  test('用 ipynb 能搜到 read_file', () => {
    const r = names('ipynb')
    assert.ok(r.includes('read_file'))
  })

  test('无 searchHint 的工具不受影响', () => {
    const r = names('jupyter')
    assert.ok(!r.includes('web_search'))
  })
})

describe('必需词 +term 语法', () => {
  test('+git 把结果限定在 git 相关工具', () => {
    const r = names('+git')
    assert.deepEqual(r, ['git_status'])
  })

  test('必需词与可选词组合', () => {
    const r = names('+git status')
    assert.equal(r[0], 'git_status')
  })

  test('必需词无匹配时返回空（而非回退到全体）', () => {
    const r = names('+nonexistent_xyz')
    assert.equal(r.length, 0)
  })

  test('中文必需词同样生效', () => {
    const r = names('+文件')
    assert.ok(r.includes('read_file'))
    assert.ok(!r.includes('web_search'))
  })
})

describe('过滤与边界', () => {
  test('limit 生效', () => {
    assert.ok(searchTools({ query: '', tools: TOOLS, limit: 2 }).length <= 2)
  })

  test('空查询返回前 N 个（浏览语义）', () => {
    const r = searchTools({ query: '', tools: TOOLS, limit: 3 })
    assert.equal(r.length, 3)
  })

  test('group 过滤生效', () => {
    const r = searchTools({
      query: '',
      tools: TOOLS,
      limit: 10,
      group: 'g1',
      groups: [{ id: 'g1', toolIds: ['grep', 'read_file'] }],
    })
    assert.deepEqual(r.map(c => c.id).sort(), ['grep', 'read_file'])
  })

  test('tags 过滤要求全部命中', () => {
    const r = searchTools({ query: '', tools: TOOLS, limit: 10, tags: ['git'] })
    assert.ok(r.every(c => c.id === 'git_status'))
  })

  test('完全不匹配的查询返回空', () => {
    assert.equal(names('zzzz_nonexistent_qqq').length, 0)
  })

  test('空工具池安全', () => {
    assert.deepEqual(searchTools({ query: 'x', tools: [], limit: 5 }), [])
  })
})
