import { describe, it, expect } from 'vitest'
import {
  collectSurfacedMemories,
  filterAlreadySurfaced,
  computeRemainingBudget,
  selectMemoriesToSurface,
  MAX_SESSION_MEMORY_BYTES,
  MAX_MEMORIES_PER_TURN,
} from '../../engine/memory/memorySurfaceBudget'
import type { RecalledMemory } from '../../engine/memory/memoryRecall'

/**
 * 会话预算与去重的核心契约：
 *   1. 同一条记忆在同一会话里只注入一次
 *   2. 累计注入不超过会话上限
 *   3. **压缩后预算自动重置**（扫描消息而非计数器 —— 这是关键设计）
 */

/** 构造一条已注入的记忆消息 */
function memoryMessage(entries: Array<{ name: string; file: string; body: string }>): {
  role: string
  content: string
} {
  const blocks = entries
    .map(e => `### ${e.name} · ${e.file}（今天保存）\n\n${e.body}`)
    .join('\n\n')
  return {
    role: 'user',
    content: `<memory>\n以下是此前沉淀的记忆，供你参考。\n\n${blocks}\n</memory>`,
  }
}

function mem(file: string, bodySize: number, name = file.replace(/\.md$/, '')): RecalledMemory {
  return {
    file,
    absPath: `/x/${file}`,
    name,
    description: '',
    type: 'project',
    mtimeMs: Date.now(),
    score: 5,
    body: 'x'.repeat(bodySize),
    ageDays: 0,
  }
}

describe('collectSurfacedMemories — 扫历史', () => {
  it('空消息返回空结果', () => {
    const r = collectSurfacedMemories([])
    expect(r.files.size).toBe(0)
    expect(r.totalBytes).toBe(0)
  })

  it('无记忆块的消息被忽略', () => {
    const r = collectSurfacedMemories([{ role: 'user', content: '普通消息' }])
    expect(r.files.size).toBe(0)
  })

  it('提取出注入过的文件名', () => {
    const msg = memoryMessage([
      { name: 'A', file: 'a.md', body: 'aaa' },
      { name: 'B', file: 'b.md', body: 'bbb' },
    ])
    const r = collectSurfacedMemories([msg])
    expect([...r.files].sort()).toEqual(['a.md', 'b.md'])
  })

  it('累加字节数', () => {
    const msg = memoryMessage([{ name: 'A', file: 'a.md', body: 'x'.repeat(100) }])
    const r = collectSurfacedMemories([msg])
    expect(r.totalBytes).toBeGreaterThan(100)
  })

  it('多条消息累加', () => {
    const m1 = memoryMessage([{ name: 'A', file: 'a.md', body: 'x'.repeat(50) }])
    const m2 = memoryMessage([{ name: 'B', file: 'b.md', body: 'x'.repeat(50) }])
    const r = collectSurfacedMemories([m1, m2])
    expect(r.files.size).toBe(2)
  })

  it('同一文件在多条消息里出现只记一次', () => {
    const m1 = memoryMessage([{ name: 'A', file: 'a.md', body: 'x' }])
    const m2 = memoryMessage([{ name: 'A', file: 'a.md', body: 'x' }])
    const r = collectSurfacedMemories([m1, m2])
    expect(r.files.size).toBe(1)
    // 字节数仍然累加（它确实占了两次上下文）
    expect(r.totalBytes).toBeGreaterThan(0)
  })

  it('支持内容块数组形态的消息', () => {
    const text = memoryMessage([{ name: 'A', file: 'a.md', body: 'x' }]).content
    const r = collectSurfacedMemories([{ role: 'user', content: [{ type: 'text', text }] }])
    expect(r.files.has('a.md')).toBe(true)
  })

  it('畸形消息不崩', () => {
    expect(() =>
      collectSurfacedMemories([{}, { content: null }, { content: 42 }, { content: [null, 1] }]),
    ).not.toThrow()
  })

  it('多个记忆块（同一条消息里两次注入）都被统计', () => {
    const one = memoryMessage([{ name: 'A', file: 'a.md', body: 'x' }]).content
    const two = memoryMessage([{ name: 'B', file: 'b.md', body: 'y' }]).content
    const r = collectSurfacedMemories([{ role: 'user', content: `${one}\n中间\n${two}` }])
    expect([...r.files].sort()).toEqual(['a.md', 'b.md'])
  })

  it('无文件名的旧格式块不产生文件记录（但计入字节）', () => {
    const legacy = { role: 'user', content: '<memory>\n### 标题没有文件名\n\n内容\n</memory>' }
    const r = collectSurfacedMemories([legacy])
    expect(r.files.size).toBe(0)
    expect(r.totalBytes).toBeGreaterThan(0)
  })
})

describe('filterAlreadySurfaced — 去重 + 预算', () => {
  it('已注入过的被过滤掉', () => {
    const surfaced = { files: new Set(['a.md']), totalBytes: 0 }
    const out = filterAlreadySurfaced([mem('a.md', 10), mem('b.md', 10)], surfaced)
    expect(out.map(m => m.file)).toEqual(['b.md'])
  })

  it('额度耗尽时返回空', () => {
    const surfaced = { files: new Set<string>(), totalBytes: MAX_SESSION_MEMORY_BYTES }
    expect(filterAlreadySurfaced([mem('a.md', 10)], surfaced)).toEqual([])
  })

  it('超额的条目被跳过，但后续更小的仍可入选', () => {
    const surfaced = { files: new Set<string>(), totalBytes: MAX_SESSION_MEMORY_BYTES - 100 }
    const out = filterAlreadySurfaced([mem('big.md', 500), mem('small.md', 50)], surfaced)
    expect(out.map(m => m.file)).toEqual(['small.md'])
  })

  it('单轮条数上限生效', () => {
    const many = Array.from({ length: 10 }, (_, i) => mem(`m${i}.md`, 10))
    const out = filterAlreadySurfaced(many, { files: new Set(), totalBytes: 0 })
    expect(out.length).toBe(MAX_MEMORIES_PER_TURN)
  })

  it('空候选返回空', () => {
    expect(filterAlreadySurfaced([], { files: new Set(), totalBytes: 0 })).toEqual([])
  })

  it('累计字节被真实计入', () => {
    const surfaced = { files: new Set<string>(), totalBytes: 0 }
    const out = filterAlreadySurfaced(
      [mem('a.md', 100), mem('b.md', 100)],
      surfaced,
      MAX_SESSION_MEMORY_BYTES,
    )
    const total = out.reduce((n, m) => n + Buffer.byteLength(m.body, 'utf8'), 0)
    expect(total).toBe(200)
  })
})

describe('computeRemainingBudget', () => {
  it('未注入时等于上限', () => {
    expect(computeRemainingBudget({ files: new Set(), totalBytes: 0 })).toBe(MAX_SESSION_MEMORY_BYTES)
  })

  it('按已用量递减', () => {
    expect(computeRemainingBudget({ files: new Set(), totalBytes: 1000 })).toBe(
      MAX_SESSION_MEMORY_BYTES - 1000,
    )
  })

  it('超支时收敛为 0（不出现负数）', () => {
    expect(computeRemainingBudget({ files: new Set(), totalBytes: MAX_SESSION_MEMORY_BYTES * 2 })).toBe(0)
  })

  it('上限为 60KB（对齐上游）', () => {
    expect(MAX_SESSION_MEMORY_BYTES).toBe(60 * 1024)
  })
})

describe('selectMemoriesToSurface — 一步到位', () => {
  it('首次注入全部候选', () => {
    const r = selectMemoriesToSurface([mem('a.md', 10), mem('b.md', 10)], [])
    expect(r.selected.length).toBe(2)
    // remainingBytes 已扣除本轮选中量 —— 调用方据此做后续判断才不会高估
    expect(r.selectedBytes).toBe(20)
    expect(r.remainingBytes).toBe(MAX_SESSION_MEMORY_BYTES - 20)
  })

  it('remainingBytes 反映「注入后」的额度而非注入前', () => {
    const r = selectMemoriesToSurface([mem('a.md', 500)], [])
    expect(r.remainingBytes).toBe(MAX_SESSION_MEMORY_BYTES - 500)
  })

  it('第二轮不再重复注入', () => {
    const candidates = [mem('a.md', 10)]
    const first = selectMemoriesToSurface(candidates, [])
    expect(first.selected.length).toBe(1)

    // 构造"已注入"的历史
    const history = [
      memoryMessage([{ name: 'a', file: 'a.md', body: 'x'.repeat(10) }]),
    ]
    const second = selectMemoriesToSurface(candidates, history)
    expect(second.selected.length).toBe(0)
  })

  it('**压缩后预算与去重自动重置**（扫描消息而非计数器）', () => {
    const candidates = [mem('a.md', 10)]

    // 压缩前：a.md 在历史里 → 不再注入
    const before = selectMemoriesToSurface(candidates, [
      memoryMessage([{ name: 'a', file: 'a.md', body: 'x'.repeat(10) }]),
    ])
    expect(before.selected.length).toBe(0)

    // 压缩后：历史被裁掉（传入的消息列表里没有那条记忆） → 重新注入
    // 这正是上游注释说的"compact 之后旧附件从上下文消失，重新浮现是合法的"
    const after = selectMemoriesToSurface(candidates, [
      { role: 'user', content: '压缩后的消息' },
    ])
    expect(after.selected.length).toBe(1)
  })

  it('预算耗尽后不再注入', () => {
    // 构造一个已用满额度的历史
    const huge = memoryMessage([
      { name: 'huge', file: 'huge.md', body: 'x'.repeat(MAX_SESSION_MEMORY_BYTES) },
    ])
    const r = selectMemoriesToSurface([mem('new.md', 10)], [huge])
    expect(r.selected.length).toBe(0)
    expect(r.remainingBytes).toBe(0)
  })

  it('返回的 surfaced 反映当前历史状态', () => {
    const history = [memoryMessage([{ name: 'a', file: 'a.md', body: 'x' }])]
    const r = selectMemoriesToSurface([], history)
    expect(r.surfaced.files.has('a.md')).toBe(true)
  })

  it('候选为空时安全', () => {
    const r = selectMemoriesToSurface([], [])
    expect(r.selected).toEqual([])
    expect(r.remainingBytes).toBe(MAX_SESSION_MEMORY_BYTES)
  })
})
