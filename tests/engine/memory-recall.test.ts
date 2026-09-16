/**
 * engine/memory/memoryRecall.ts 单元测试
 *
 * 覆盖：路径编码、frontmatter 解析、相关性打分、召回排序、正文截断、老化提示。
 */
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  sanitizeProjectPath,
  parseFrontmatter,
  scanMemories,
  scoreMemory,
  memoryAgeDays,
  recallMemories,
  formatMemoriesForPrompt,
  buildMemoryPromptSection,
  type MemoryEntry,
} from '../../src/engine/memory/memoryRecall.ts'

let tmpDir: string

function memFile(fm: Record<string, string>, body: string): string {
  const lines = ['---']
  for (const [k, v] of Object.entries(fm)) lines.push(`${k}: ${v}`)
  lines.push('---', '', body)
  return lines.join('\n')
}

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kx2-mem-'))

  await fs.writeFile(
    path.join(tmpDir, 'chat-stream-pipeline.md'),
    memFile(
      { name: '聊天流式链路回归', description: '工具调用后答复丢失的根因与修复', type: 'project' },
      'chat-handlers.ts 的 eventHandler 未传给引擎，导致流事件全部丢失。',
    ),
  )
  await fs.writeFile(
    path.join(tmpDir, 'feedback_image_files.md'),
    memFile(
      { name: '图片文件不读取内容', description: '列目录时遇到图片类文件只返回列表', type: 'feedback' },
      '遇到 png/jpg/ico 等只列出文件名，不要读取二进制内容。',
    ),
  )
  await fs.writeFile(
    path.join(tmpDir, 'unrelated-note.md'),
    memFile(
      { name: '构建脚本备忘', description: 'electron-builder 打包注意事项', type: 'reference' },
      '打包前先跑 npm run build。',
    ),
  )
  // 索引文件本身不应被召回
  await fs.writeFile(path.join(tmpDir, 'MEMORY.md'), '# MEMORY\n\n- [X](x.md) — 简介\n')
  // 非 md 文件应被忽略
  await fs.writeFile(path.join(tmpDir, 'notes.txt'), 'ignore me')
})

after(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('sanitizeProjectPath', () => {
  test('非字母数字一律替换为短横线（与 Claude Code memdir 同规则）', () => {
    assert.equal(sanitizeProjectPath('D:\\KX2API'), 'D--KX2API')
    assert.equal(sanitizeProjectPath('/home/u/proj'), '-home-u-proj')
    assert.equal(sanitizeProjectPath('D:\\KX2API'), 'D--KX2API')
  })

  test('纯字母数字保持不变', () => {
    assert.equal(sanitizeProjectPath('abc123'), 'abc123')
  })

  test('超长路径截断并追加哈希后缀，保证长度受限且可区分', () => {
    const long = 'D:\\' + 'a'.repeat(400)
    const out = sanitizeProjectPath(long)
    assert.ok(out.length <= 220, `长度应受限，实际 ${out.length}`)
    assert.notEqual(sanitizeProjectPath(long + 'b'), out)
  })
})

describe('parseFrontmatter', () => {
  test('解析标量字段并剥离引号', () => {
    const fm = parseFrontmatter('---\nname: 标题\ntype: "project"\n---\n正文')
    assert.equal(fm.name, '标题')
    assert.equal(fm.type, 'project')
  })

  test('无 frontmatter 时返回空对象', () => {
    assert.deepEqual(parseFrontmatter('# 纯正文\n没有头部'), {})
  })

  test('未闭合的 frontmatter 不会误吞正文', () => {
    assert.deepEqual(parseFrontmatter('---\nname: x'), {})
  })
})

describe('scanMemories', () => {
  test('排除 MEMORY.md 索引与非 md 文件', async () => {
    const entries = await scanMemories(tmpDir)
    const files = entries.map(e => e.file).sort()
    assert.deepEqual(files, [
      'chat-stream-pipeline.md',
      'feedback_image_files.md',
      'unrelated-note.md',
    ])
  })

  test('正确填充 name / description / type', async () => {
    const entries = await scanMemories(tmpDir)
    const target = entries.find(e => e.file === 'chat-stream-pipeline.md')
    assert.ok(target)
    assert.equal(target.name, '聊天流式链路回归')
    assert.equal(target.description, '工具调用后答复丢失的根因与修复')
    assert.equal(target.type, 'project')
  })

  test('未知 type 降级为 undefined 而非抛错', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kx2-mem-t-'))
    await fs.writeFile(path.join(dir, 'a.md'), memFile({ name: 'A', type: 'bogus' }, 'x'))
    const entries = await scanMemories(dir)
    assert.equal(entries[0].type, undefined)
    await fs.rm(dir, { recursive: true, force: true })
  })

  test('目录不存在时返回空数组而不是抛错', async () => {
    assert.deepEqual(await scanMemories(path.join(tmpDir, '__nope__')), [])
  })
})

describe('scoreMemory', () => {
  const entry: MemoryEntry = {
    file: 'chat-stream-pipeline.md',
    absPath: 'x',
    name: '聊天流式链路回归',
    description: '工具调用后答复丢失的根因与修复',
    type: 'project',
    mtimeMs: Date.now(),
  }

  test('查询中出现记忆名称 → 强加分', () => {
    assert.ok(scoreMemory(entry, '聊天流式链路的根因是什么') >= 2)
  })

  test('描述词元重叠 → 加分', () => {
    assert.ok(scoreMemory(entry, '工具调用 答复 丢失') > 0)
  })

  test('完全不相关 → 0 分', () => {
    assert.equal(scoreMemory(entry, 'zzz qqq'), 0)
  })

  test('空查询 → 0 分', () => {
    assert.equal(scoreMemory(entry, '   '), 0)
  })
})

describe('memoryAgeDays', () => {
  test('今天为 0，昨天为 1，更早按天数递增', () => {
    const now = Date.now()
    assert.equal(memoryAgeDays(now, now), 0)
    assert.equal(memoryAgeDays(now - 86_400_000, now), 1)
    assert.equal(memoryAgeDays(now - 5 * 86_400_000, now), 5)
  })

  test('未来时间戳收敛为 0 而非负数', () => {
    const now = Date.now()
    assert.equal(memoryAgeDays(now + 86_400_000, now), 0)
  })
})

describe('recallMemories', () => {
  test('只召回相关记忆，且按分数降序', async () => {
    const got = await recallMemories('聊天流式链路 答复 丢失', { memoryDir: tmpDir })
    assert.ok(got.length >= 1)
    assert.equal(got[0].file, 'chat-stream-pipeline.md')
    for (let i = 1; i < got.length; i++) {
      assert.ok(got[i - 1].score >= got[i].score, '结果应按分数降序')
    }
  })

  test('无关记忆不会被召回', async () => {
    const got = await recallMemories('聊天流式链路', { memoryDir: tmpDir })
    assert.ok(!got.some(m => m.file === 'unrelated-note.md'))
  })

  test('limit 生效', async () => {
    const got = await recallMemories('工具 图片 打包 聊天', { memoryDir: tmpDir, limit: 1 })
    assert.equal(got.length, 1)
  })

  test('正文受字节预算限制', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kx2-mem-b-'))
    await fs.writeFile(
      path.join(dir, 'big.md'),
      memFile({ name: '大文件', description: 'big', type: 'project' }, 'A'.repeat(50_000)),
    )
    const got = await recallMemories('大文件 big', { memoryDir: dir })
    assert.equal(got.length, 1)
    assert.ok(Buffer.byteLength(got[0].body, 'utf8') <= 4096 + 64, '单条记忆正文应被截断')
    await fs.rm(dir, { recursive: true, force: true })
  })

  test('空目录返回空数组', async () => {
    assert.deepEqual(await recallMemories('任意', { memoryDir: path.join(tmpDir, '__none__') }), [])
  })
})

describe('formatMemoriesForPrompt / buildMemoryPromptSection', () => {
  test('无记忆时返回 null（避免塞入空标题）', () => {
    assert.equal(formatMemoriesForPrompt([]), null)
  })

  test('渲染为 <memory> 包裹的文本块，并带可信度免责说明', async () => {
    const got = await recallMemories('聊天流式链路', { memoryDir: tmpDir })
    const text = formatMemoriesForPrompt(got)
    assert.ok(text)
    assert.ok(text!.startsWith('<memory>'))
    assert.ok(text!.endsWith('</memory>'))
    assert.ok(text!.includes('核对当前代码'))
  })

  test('超过一天的记忆附带过时提醒', () => {
    const old: MemoryEntry & { score: number; body: string; ageDays: number } = {
      file: 'a.md',
      absPath: 'x',
      name: '旧记忆',
      description: 'd',
      type: 'project',
      mtimeMs: Date.now() - 10 * 86_400_000,
      score: 3,
      body: '内容',
      ageDays: 10,
    }
    const text = formatMemoriesForPrompt([old])!
    assert.ok(text.includes('10 天前保存'))
    assert.ok(text.includes('可能已过时'))
  })

  test('端到端：buildMemoryPromptSection 无相关记忆时返回 null', async () => {
    const text = await buildMemoryPromptSection('zzz 完全无关的查询 qqq', { memoryDir: tmpDir })
    assert.equal(text, null)
  })

  test('端到端：相关查询返回可注入文本', async () => {
    const text = await buildMemoryPromptSection('聊天流式链路 的根因', { memoryDir: tmpDir })
    assert.ok(text && text.includes('聊天流式链路回归'))
  })

  test('目录不可用时静默降级为 null（记忆不应阻断主请求）', async () => {
    const text = await buildMemoryPromptSection('x', {
      memoryDir: '\u0000invalid\u0000path',
    })
    assert.equal(text, null)
  })
})
