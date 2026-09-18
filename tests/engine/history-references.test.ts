/**
 * engine/history 模块测试
 *
 * 覆盖 references 引用解析与 historyManager 时间戳历史。
 * 其中包含一处真实缺陷的回归：
 *   FILE_REF_RE 是 `/@([^\s]+)/` 的贪婪形式，会**吞掉所有 @xxx** ——
 *   `@img/photo.png`、`@paste`、`@url/...` 都会被额外解析成 type:'file'，
 *   产生重复且错误的引用。
 *
 * 运行：node --import tsx --test tests/engine/history-references.test.ts
 */
import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import {
  parseReferences,
  formatPastedTextRef,
  getPastedTextRefNumLines,
  expandPastedTextRefs,
  formatImageRef,
} from '../../src/engine/history/references.ts'
import { historyManager } from '../../src/engine/history/historyManager.ts'

describe('parseReferences — 文件引用', () => {
  test('解析 @path 与行范围', () => {
    const refs = parseReferences('看看 @src/index.ts:10-20 这段')
    const file = refs.find((r) => r.type === 'file')
    assert.ok(file)
    assert.equal((file as { path: string }).path, 'src/index.ts')
    assert.equal((file as { startLine?: number }).startLine, 10)
    assert.equal((file as { endLine?: number }).endLine, 20)
  })

  test('解析 @path 不带行号', () => {
    const refs = parseReferences('@package.json')
    const file = refs.find((r) => r.type === 'file')
    assert.equal((file as { path: string }).path, 'package.json')
    assert.equal((file as { startLine?: number }).startLine, undefined)
  })

  test('解析单个起始行 @file:5', () => {
    const refs = parseReferences('@a.ts:5')
    const file = refs.find((r) => r.type === 'file')
    assert.equal((file as { startLine?: number }).startLine, 5)
    assert.equal((file as { endLine?: number }).endLine, undefined)
  })
})

describe('parseReferences — 特殊引用类型', () => {
  test('@img/ 解析为 image 引用', () => {
    const refs = parseReferences('@img/screenshots/a.png')
    const img = refs.find((r) => r.type === 'image')
    assert.ok(img, '应解析出 image 引用')
    assert.equal((img as { path: string }).path, 'screenshots/a.png')
  })

  test('@img/ 不应同时被解析为 file 引用（回归：贪婪正则越界）', () => {
    const refs = parseReferences('@img/screenshots/a.png')
    const files = refs.filter((r) => r.type === 'file')
    assert.equal(files.length, 0, `@img/ 被误判为 file 引用：${JSON.stringify(files)}`)
  })

  test('@paste 无索引时 index 为 0', () => {
    const refs = parseReferences('引用 @paste 的内容')
    const p = refs.find((r) => r.type === 'paste')
    assert.equal((p as { index: number }).index, 0)
  })

  test('@paste[3] 解析出索引 3', () => {
    const refs = parseReferences('@paste[3]')
    const p = refs.find((r) => r.type === 'paste')
    assert.equal((p as { index: number }).index, 3)
  })

  test('@paste 不应被解析为 file 引用（回归）', () => {
    const refs = parseReferences('@paste[2]')
    assert.equal(refs.filter((r) => r.type === 'file').length, 0, '应无 file 引用')
  })

  test('@url/ 解析为 url 引用且不越界成 file', () => {
    const refs = parseReferences('@url/https://example.com/a?b=1')
    const u = refs.find((r) => r.type === 'url')
    assert.ok(u, '应解析出 url 引用')
    assert.equal((u as { url: string }).url, 'https://example.com/a?b=1')
    assert.equal(refs.filter((r) => r.type === 'file').length, 0, '@url/ 不应产生 file 引用')
  })

  test('纯文本无引用时返回空数组', () => {
    assert.deepEqual(parseReferences('这段文字里没有任何引用标记'), [])
  })

  test('邮箱地址不被误判（无 @ 引用语义）', () => {
    // 注意：mailto 场景下 `@example.com` 形状确实像 @ref，
    // 这是该语法的固有限制；此处仅锁定当前行为，便于日后若加白名单可感知变化。
    const refs = parseReferences('联系 user@example.com')
    const files = refs.filter((r) => r.type === 'file')
    assert.equal(files.length, 1, '当前实现会把 user@example.com 的域名部分当引用（已知限制）')
  })
})

describe('引用格式化与展开', () => {
  test('formatPastedTextRef', () => {
    assert.equal(formatPastedTextRef(2), '@paste[2]')
  })

  test('getPastedTextRefNumLines 按换行计数', () => {
    assert.equal(getPastedTextRefNumLines('a\nb\nc'), 3)
    assert.equal(getPastedTextRefNumLines('single'), 1)
  })

  test('expandPastedTextRefs 替换为实际内容', () => {
    const pastes = new Map([[0, 'PASTE0'], [3, 'PASTE3']])
    assert.equal(expandPastedTextRefs('前 @paste 中 @paste[3] 后', pastes), '前 PASTE0 中 PASTE3 后')
  })

  test('expandPastedTextRefs 缺失索引时保留占位标记', () => {
    assert.equal(expandPastedTextRefs('@paste[9]', new Map()), '[paste:9]')
  })

  test('formatImageRef', () => {
    assert.equal(formatImageRef('a/b.png'), '@img/a/b.png')
  })
})

describe('historyManager — 时间戳历史', () => {
  beforeEach(() => historyManager.clearHistory())

  test('addToHistory 追加并附时间戳', () => {
    const before = Date.now()
    historyManager.addToHistory({ role: 'user', content: '你好' })
    const after = Date.now()
    assert.equal(historyManager.size, 1)
    const [e] = historyManager.getRecentHistory()
    assert.equal(e.role, 'user')
    assert.equal(e.content, '你好')
    assert.ok(e.timestamp >= before && e.timestamp <= after)
  })

  test('getRecentHistory 按 limit 取尾部', () => {
    for (let i = 0; i < 5; i++) historyManager.addToHistory({ role: 'user', content: `m${i}` })
    const recent = historyManager.getRecentHistory(2)
    assert.equal(recent.length, 2)
    assert.equal(recent[0].content, 'm3')
    assert.equal(recent[1].content, 'm4')
  })

  test('getRecentHistory 返回副本，外部修改不影响内部', () => {
    historyManager.addToHistory({ role: 'user', content: 'orig' })
    const [e] = historyManager.getRecentHistory()
    e.content = 'tampered'
    assert.equal(historyManager.getRecentHistory()[0].content, 'orig')
  })

  test('removeLastFromHistory 空历史返回 false', () => {
    assert.equal(historyManager.removeLastFromHistory(), false)
  })

  test('removeLastFromHistory 移除最后一条', () => {
    historyManager.addToHistory({ role: 'user', content: 'a' })
    historyManager.addToHistory({ role: 'user', content: 'b' })
    assert.equal(historyManager.removeLastFromHistory(), true)
    assert.equal(historyManager.size, 1)
    assert.equal(historyManager.getRecentHistory()[0].content, 'a')
  })

  test('clearHistory 清空全部', () => {
    historyManager.addToHistory({ role: 'user', content: 'a' })
    historyManager.clearHistory()
    assert.equal(historyManager.size, 0)
  })

  test('getHistory 异步生成器按序产出', async () => {
    historyManager.addToHistory({ role: 'user', content: 'x' })
    historyManager.addToHistory({ role: 'assistant', content: 'y' })
    const got: string[] = []
    for await (const e of historyManager.getHistory()) got.push(e.content as string)
    assert.deepEqual(got, ['x', 'y'])
  })

  test('引用随条目一起保存', () => {
    historyManager.addToHistory({
      role: 'user',
      content: '@a.ts',
      references: [{ type: 'file', path: 'a.ts' }],
    })
    const e = historyManager.getRecentHistory()[0]
    assert.equal(e.references!.length, 1)
    assert.equal((e.references![0] as { path: string }).path, 'a.ts')
  })
})
