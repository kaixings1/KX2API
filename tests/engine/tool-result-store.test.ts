/**
 * engine/toolResultStore.ts 单元测试
 *
 * 覆盖：阈值判定、预览行边界、幂等落盘、路径穿越防护、失败降级、清理。
 */
import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  DEFAULT_MAX_RESULT_SIZE_CHARS,
  PREVIEW_SIZE_BYTES,
  PERSISTED_OUTPUT_TAG,
  PERSISTED_OUTPUT_CLOSING_TAG,
  setToolResultsBaseDir,
  getToolResultsDir,
  getToolResultPath,
  generatePreview,
  persistToolResult,
  isPersistError,
  buildLargeToolResultMessage,
  maybePersistToolResult,
  cleanupToolResults,
} from '../../src/engine/toolResultStore.ts'

let tmpDir: string

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kx2-toolres-'))
})

after(async () => {
  setToolResultsBaseDir(null)
  await fs.rm(tmpDir, { recursive: true, force: true })
})

beforeEach(async () => {
  setToolResultsBaseDir(tmpDir)
  await fs.rm(getToolResultsDir(), { recursive: true, force: true })
})

describe('generatePreview', () => {
  test('未超限时原样返回且 hasMore=false', () => {
    const r = generatePreview('short', 100)
    assert.equal(r.preview, 'short')
    assert.equal(r.hasMore, false)
  })

  test('超限时在最近换行处切开（不切断行）', () => {
    const line = 'x'.repeat(50)
    const content = Array.from({ length: 20 }, () => line).join('\n') // 20*50 + 19 = 1019 字符
    const r = generatePreview(content, 300)
    assert.equal(r.hasMore, true)
    assert.ok(r.preview.length <= 300)
    assert.ok(!r.preview.endsWith('\n'))
    // 切开后每一行都应是完整行
    for (const l of r.preview.split('\n')) {
      assert.equal(l.length, l === r.preview.split('\n').slice(-1)[0] ? l.length : 50)
    }
  })

  test('最近换行离上限太远时按上限硬切（避免预览过短）', () => {
    const content = 'a'.repeat(1000) + '\n' + 'b'.repeat(1000)
    const r = generatePreview(content, 200)
    assert.equal(r.hasMore, true)
    assert.equal(r.preview.length, 200)
  })

  test('恰好等于上限时不算超限', () => {
    const content = 'z'.repeat(100)
    assert.equal(generatePreview(content, 100).hasMore, false)
  })
})

describe('getToolResultPath — 路径穿越防护', () => {
  // 断言方式：安全性的判据不是"字符串里没有 .."，而是"解析后目录没变"。
  // `..` 作为普通文件名字符是安全的（如 .._.._etc_passwd.txt），
  // 真正危险的是未替换的路径分隔符。
  test('toolUseId 中的路径分隔符被替换，无法逃出落盘目录', () => {
    const p = getToolResultPath('../../etc/passwd', false)
    assert.equal(path.dirname(p), getToolResultsDir(), '解析后必须仍在落盘目录内')
    assert.ok(!path.basename(p).includes('/'), '文件名不应含正斜杠')
  })

  test('Windows 绝对路径同样无法逃逸', () => {
    const p = getToolResultPath('C:\\Windows\\system32\\config', false)
    assert.equal(path.dirname(p), getToolResultsDir())
    assert.ok(!path.basename(p).includes('\\'), '文件名不应含反斜杠')
    assert.ok(!path.basename(p).includes(':'), '文件名不应含冒号')
  })

  test('各种逃逸尝试均被约束在目录内', () => {
    for (const evil of ['..', '.', '../..', '....//....//x', '/etc/passwd', '\\\\server\\share', 'a/../../b']) {
      const p = getToolResultPath(evil, false)
      assert.equal(path.dirname(p), getToolResultsDir(), `逃逸尝试失败: ${evil}`)
      assert.ok(path.basename(p).length > 0)
    }
  })

  test('超长 id 被截断', () => {
    const p = getToolResultPath('a'.repeat(1000), false)
    assert.ok(path.basename(p).length <= 210)
  })

  test('json 与文本用不同扩展名', () => {
    assert.ok(getToolResultPath('x', true).endsWith('.json'))
    assert.ok(getToolResultPath('x', false).endsWith('.txt'))
  })
})

describe('persistToolResult', () => {
  test('文本结果落盘并返回预览', async () => {
    const content = 'line\n'.repeat(1000) // 5000 字符
    const r = await persistToolResult(content, 'tool_1')
    assert.ok(!isPersistError(r))
    if (isPersistError(r)) return
    assert.equal(r.originalSize, content.length)
    assert.equal(r.isJson, false)
    assert.ok(r.hasMore)
    assert.ok(r.preview.length <= PREVIEW_SIZE_BYTES)
    const onDisk = await fs.readFile(r.filepath, 'utf-8')
    assert.equal(onDisk, content, '磁盘内容应与原始完全一致')
  })

  test('幂等：同一 id 二次落盘不覆盖已有内容', async () => {
    const first = await persistToolResult('原始内容', 'tool_idem')
    assert.ok(!isPersistError(first))
    if (isPersistError(first)) return
    await fs.writeFile(first.filepath, '被外部改动', 'utf-8')

    const second = await persistToolResult('新内容', 'tool_idem')
    assert.ok(!isPersistError(second))
    if (isPersistError(second)) return
    assert.equal(second.filepath, first.filepath)
    const onDisk = await fs.readFile(second.filepath, 'utf-8')
    assert.equal(onDisk, '被外部改动', 'EEXIST 时不应覆盖')
  })

  test('数组结果存为 JSON', async () => {
    const blocks = [{ type: 'text', text: 'hello' }]
    const r = await persistToolResult(blocks, 'tool_json')
    assert.ok(!isPersistError(r))
    if (isPersistError(r)) return
    assert.equal(r.isJson, true)
    assert.ok(r.filepath.endsWith('.json'))
  })

  test('含非文本块的结果拒绝落盘', async () => {
    const r = await persistToolResult([{ type: 'image', source: {} }], 'tool_img')
    assert.ok(isPersistError(r))
  })

  test('空字符串可落盘', async () => {
    const r = await persistToolResult('', 'tool_empty')
    assert.ok(!isPersistError(r))
  })
})

describe('buildLargeToolResultMessage', () => {
  test('包含路径、大小与预览，且被标记包裹', () => {
    const msg = buildLargeToolResultMessage({
      filepath: 'C:\\tmp\\a.txt',
      originalSize: 123456,
      isJson: false,
      preview: 'preview text',
      hasMore: true,
    })
    assert.ok(msg.startsWith(PERSISTED_OUTPUT_TAG))
    assert.ok(msg.endsWith(PERSISTED_OUTPUT_CLOSING_TAG))
    assert.ok(msg.includes('C:\\tmp\\a.txt'))
    assert.ok(msg.includes('preview text'))
    assert.ok(msg.includes('120.6 KB'))
  })

  test('无更多内容时不显示省略号', () => {
    const msg = buildLargeToolResultMessage({
      filepath: 'p',
      originalSize: 10,
      isJson: false,
      preview: 'x',
      hasMore: false,
    })
    assert.ok(!msg.includes('...'))
  })
})

describe('maybePersistToolResult', () => {
  test('未超阈值时原样返回（不落盘）', async () => {
    const small = 'a'.repeat(DEFAULT_MAX_RESULT_SIZE_CHARS)
    const out = await maybePersistToolResult(small, 'tool_small')
    assert.equal(out, small)
    await assert.rejects(() => fs.access(getToolResultPath('tool_small', false)))
  })

  test('超阈值时落盘并返回预览文本', async () => {
    const big = 'b'.repeat(DEFAULT_MAX_RESULT_SIZE_CHARS + 1)
    const out = await maybePersistToolResult(big, 'tool_big')
    assert.notEqual(out, big)
    assert.ok(out.includes(PERSISTED_OUTPUT_TAG))
    assert.ok(out.length < big.length, '预览应显著短于原文')
  })

  test('可自定义阈值', async () => {
    const out = await maybePersistToolResult('abcdef', 'tool_custom', 3)
    assert.ok(out.includes(PERSISTED_OUTPUT_TAG))
  })

  test('落盘失败时降级为返回原内容（绝不丢结果）', async () => {
    // 指向一个不可能创建成功的目录
    setToolResultsBaseDir('\u0000invalid\u0000')
    const big = 'c'.repeat(DEFAULT_MAX_RESULT_SIZE_CHARS + 10)
    const out = await maybePersistToolResult(big, 'tool_fail')
    assert.equal(out, big, '落盘失败必须原样返回，不能丢工具输出')
    setToolResultsBaseDir(tmpDir)
  })

  test('非字符串输入安全降级', async () => {
    const out = await maybePersistToolResult(undefined as unknown as string, 'tool_undef')
    assert.equal(typeof out, 'string')
  })
})

describe('cleanupToolResults', () => {
  test('按 mtime 清理过期文件，保留新文件', async () => {
    const r1 = await persistToolResult('old', 'tool_old')
    assert.ok(!isPersistError(r1))
    if (isPersistError(r1)) return
    const old = Date.now() - 60 * 86_400_000
    await fs.utimes(r1.filepath, new Date(old), new Date(old))

    const r2 = await persistToolResult('new', 'tool_new')
    assert.ok(!isPersistError(r2))
    if (isPersistError(r2)) return

    const removed = await cleanupToolResults(30)
    assert.equal(removed, 1)
    await assert.rejects(() => fs.access(r1.filepath))
    await fs.access(r2.filepath)
  })

  test('目录不存在时返回 0 而不抛错', async () => {
    setToolResultsBaseDir(path.join(tmpDir, '__nope__'))
    assert.equal(await cleanupToolResults(30), 0)
    setToolResultsBaseDir(tmpDir)
  })
})
