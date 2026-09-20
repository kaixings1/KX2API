/**
 * tests/diffParser.test.ts — Git diff 解析纯函数测试
 *
 * 运行：node --import tsx --test tests/diffParser.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  parseDiff,
  getFileChangeSummary,
  formatDiffForDisplay,
} from '../src/engine/diffParser.ts'

const SAMPLE_DIFF = [
  'diff --git a/src/a.ts b/src/a.ts',
  'index 111..222 100644',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -10,3 +10,4 @@ export function foo() {',
  ' const a = 1',
  '-const b = 2',
  '+const b = 2 // changed',
  '+const c = 3',
  ' }',
  '',
  'diff --git a/src/newfile.ts b/src/newfile.ts',
  'new file mode 100644',
  'index 000..333',
  '--- /dev/null',
  '+++ b/src/newfile.ts',
  '@@ -0,0 +1,2 @@',
  '+// brand new',
  '+export const x = 1',
].join('\n')

describe('parseDiff 基础解析', () => {
  test('解析出文件数与 hunks', () => {
    const parsed = parseDiff(SAMPLE_DIFF)
    assert.equal(parsed.fileCount, 2)
    assert.ok(parsed.hunks.has('src/a.ts'))
    assert.ok(parsed.hunks.has('src/newfile.ts'))
    assert.equal(parsed.hasBinaryChanges, false)
  })

  test('解析 hunk 行号范围', () => {
    const parsed = parseDiff(SAMPLE_DIFF)
    const aHunks = parsed.hunks.get('src/a.ts')!
    assert.equal(aHunks.length, 1)
    const hunk = aHunks[0]
    assert.equal(hunk.oldStart, 10)
    assert.equal(hunk.oldCount, 3)
    assert.equal(hunk.newStart, 10)
    assert.equal(hunk.newCount, 4)
  })

  test('解析变更行（added/removed/context）', () => {
    const parsed = parseDiff(SAMPLE_DIFF)
    const changes = parsed.hunks.get('src/a.ts')![0].changes
    const added = changes.filter(c => c.type === 'added')
    const removed = changes.filter(c => c.type === 'removed')
    const context = changes.filter(c => c.type === 'context')
    // context 'const a=1' + removed 'const b=2' + added 'const b=2' + added 'const c=3' + context '}'
    assert.equal(added.length, 2)
    assert.equal(removed.length, 1)
    assert.equal(context.length, 2)
    assert.equal(changes.find(c => c.type === 'removed')!.oldLineNumber, 11)
  })

  test('/dev/null 新文件带虚拟路径处理', () => {
    const parsed = parseDiff(SAMPLE_DIFF)
    const changes = parsed.hunks.get('src/newfile.ts')![0].changes
    assert.equal(changes.every(c => c.type === 'added'), true)
    assert.equal(changes.length, 2)
  })

  test('二进制变更标记（独立 Binary 块）', () => {
    const bin = [
      'Binary files a/img.png and b/img.png differ',
      'diff --git a/ok.ts b/ok.ts',
      '--- a/ok.ts',
      '+++ b/ok.ts',
      '@@ -1 +1 @@',
      '-old',
      '+new',
    ].join('\n')
    const parsed = parseDiff(bin)
    assert.equal(parsed.hasBinaryChanges, true)
  })

  test('空 diff 返回空', () => {
    const parsed = parseDiff('')
    assert.equal(parsed.fileCount, 0)
    assert.equal(parsed.hunks.size, 0)
  })
})

describe('getFileChangeSummary', () => {
  test('计算增删行数', () => {
    const parsed = parseDiff(SAMPLE_DIFF)
    const s = getFileChangeSummary(parsed, 'src/a.ts')!
    assert.equal(s.addedLines, 2)
    assert.equal(s.removedLines, 1)
    assert.equal(s.totalChanges, 3)
    assert.equal(s.hunks.length, 1)
  })

  test('不存在文件返回 null', () => {
    const parsed = parseDiff(SAMPLE_DIFF)
    assert.equal(getFileChangeSummary(parsed, 'nope.ts'), null)
  })
})

describe('formatDiffForDisplay', () => {
  test('输出包含文件路径、hunk 头与行号', () => {
    const parsed = parseDiff(SAMPLE_DIFF)
    const out = formatDiffForDisplay(parsed)
    assert.ok(out.includes('📄 src/a.ts'))
    assert.ok(out.includes('@@ -10,3 +10,4 @@'))
    assert.ok(out.includes('-11: const b = 2'), 'removed 行应带旧行号')
    assert.ok(out.includes('+11: const b = 2'), 'added 行应带新行号')
  })
})