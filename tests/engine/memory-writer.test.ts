/**
 * engine/memory/memoryWriter.ts 单元测试
 *
 * 守的是记忆系统的写入侧纪律：不保存黑名单、密钥拒收、索引上限、路径安全。
 * 记忆一旦写错会在后续每轮被召回，所以这些校验比读取侧更关键。
 */
import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  checkWritable,
  toMemoryFileName,
  writeMemory,
  updateMemoryIndex,
  looksWorthRemembering,
  MAX_INDEX_LINES,
} from '../../src/engine/memory/memoryWriter.ts'
import { recallMemories, scanMemories } from '../../src/engine/memory/memoryRecall.ts'

let tmpDir: string

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kx2-memw-'))
})

after(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

beforeEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
  await fs.mkdir(tmpDir, { recursive: true })
})

const valid = {
  name: '聊天流式链路',
  description: '工具调用后答复丢失的根因',
  type: 'project' as const,
  body: '事件处理器未传给引擎时，流事件会全部丢失。',
}

describe('checkWritable — 不保存黑名单', () => {
  test('正常内容通过', () => {
    assert.equal(checkWritable(valid), null)
  })

  test('缺 name / description / body 被拒', () => {
    assert.ok(checkWritable({ ...valid, name: '' }))
    assert.ok(checkWritable({ ...valid, description: '' }))
    assert.ok(checkWritable({ ...valid, body: '  ' }))
  })

  test('拒收代码结构描述（可从代码库查到）', () => {
    const r = checkWritable({
      ...valid,
      body: '函数 query() 定义在 src/engine/index.ts 里。',
    })
    assert.ok(r && r.includes('code-structure'), `实际: ${r}`)
  })

  test('拒收 git 历史', () => {
    const r = checkWritable({ ...valid, body: '提交 0a1b2c3d4e5f 修好了这个问题。' })
    assert.ok(r && r.includes('git-history'), `实际: ${r}`)
  })

  test('拒收调试配方', () => {
    const r = checkWritable({ ...valid, body: '解决方法：改第 42 行即可。' })
    assert.ok(r && r.includes('debug-recipe'), `实际: ${r}`)
  })

  test('拒收临时任务进度', () => {
    const r = checkWritable({ ...valid, body: '当前任务：还有 3 轮没跑完。' })
    assert.ok(r && r.includes('temporary-state'), `实际: ${r}`)
  })

  test('正文过长被拒', () => {
    const r = checkWritable({ ...valid, body: 'x'.repeat(9_000) })
    assert.ok(r && r.includes('过长'))
  })
})

describe('checkWritable — 密钥扫描', () => {
  const cases: Array<[string, string]> = [
    ['openai-key', '我的 key 是 sk-abcdefghijklmnopqrstuvwxyz123456'],
    ['anthropic-key', 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz'],
    ['github-token', 'ghp_abcdefghijklmnopqrstuvwxyz1234'],
    ['aws-key', 'AKIAIOSFODNN7EXAMPLE'],
    ['jwt', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'],
    ['private-key', '-----BEGIN RSA PRIVATE KEY-----'],
    ['bearer', 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456'],
  ]

  for (const [id, text] of cases) {
    test(`拒收 ${id}`, () => {
      const r = checkWritable({ ...valid, body: text })
      assert.ok(r && r.includes('凭据'), `应拒收 ${id}，实际: ${r}`)
    })
  }

  test('普通文本不误报', () => {
    assert.equal(checkWritable({ ...valid, body: '我们的 API 地址在文档里，key 单独管理。' }), null)
  })
})

describe('toMemoryFileName — 路径安全', () => {
  test('生成 .md 文件名', () => {
    assert.equal(toMemoryFileName('聊天流式链路'), '聊天流式链路.md')
  })

  test('空格与路径分隔符被替换', () => {
    assert.equal(toMemoryFileName('a b/c'), 'a-b-c.md')
  })

  test('路径穿越尝试被中和', () => {
    const f = toMemoryFileName('../../etc/passwd')
    assert.ok(!f.includes('/'), `不应含斜杠: ${f}`)
    assert.ok(!f.includes('..'), `不应含 ..: ${f}`)
  })

  test('Windows 非法字符被替换', () => {
    const f = toMemoryFileName('a:b*c?d"e<f>g|h')
    assert.ok(!/[:*?"<>|]/.test(f), `实际: ${f}`)
  })

  test('空名字有兜底', () => {
    assert.equal(toMemoryFileName('   '), 'memory.md')
    assert.equal(toMemoryFileName('...'), 'memory.md')
  })

  test('超长名字被截断', () => {
    assert.ok(toMemoryFileName('x'.repeat(300)).length <= 85)
  })
})

describe('writeMemory — 写入与索引', () => {
  test('成功写入并创建索引', async () => {
    const r = await writeMemory(valid, { memoryDir: tmpDir })
    assert.ok(r.ok, r.reason)
    assert.equal(r.file, '聊天流式链路.md')

    const content = await fs.readFile(path.join(tmpDir, '聊天流式链路.md'), 'utf-8')
    assert.ok(content.startsWith('---'), '应有 frontmatter')
    assert.ok(content.includes('name: 聊天流式链路'))
    assert.ok(content.includes('type: project'))

    const index = await fs.readFile(path.join(tmpDir, 'MEMORY.md'), 'utf-8')
    assert.ok(index.includes('聊天流式链路.md'))
    assert.ok(index.includes('工具调用后答复丢失的根因'))
  })

  test('写入后能被 recall 检索到（读写闭环）', async () => {
    await writeMemory(valid, { memoryDir: tmpDir })
    const hits = await recallMemories('工具调用 答复 丢失', { memoryDir: tmpDir })
    assert.ok(hits.length >= 1)
    assert.equal(hits[0].name, '聊天流式链路')
    assert.equal(hits[0].type, 'project')
  })

  test('黑名单内容不落盘', async () => {
    const r = await writeMemory(
      { ...valid, body: '提交 0a1b2c3d4e5f 修好了' },
      { memoryDir: tmpDir },
    )
    assert.ok(!r.ok)
    const files = await fs.readdir(tmpDir).catch(() => [])
    assert.ok(!files.some(f => f.includes('聊天流式链路')), '不应写入文件')
  })

  test('重复写入同名 → 更新而非追加', async () => {
    await writeMemory(valid, { memoryDir: tmpDir })
    await writeMemory({ ...valid, description: '更新后的描述' }, { memoryDir: tmpDir })

    const index = await fs.readFile(path.join(tmpDir, 'MEMORY.md'), 'utf-8')
    const count = index.split('\n').filter(l => l.includes('聊天流式链路.md')).length
    assert.equal(count, 1, '索引不应出现重复条目')
    assert.ok(index.includes('更新后的描述'))
  })

  test('overwrite:false 时拒绝覆盖已存在文件', async () => {
    await writeMemory(valid, { memoryDir: tmpDir })
    const r = await writeMemory(valid, { memoryDir: tmpDir, overwrite: false })
    assert.ok(!r.ok && r.reason!.includes('已存在'))
  })

  test('autoSkill 被写入 frontmatter', async () => {
    await writeMemory({ ...valid, autoSkill: ['commit', 'verify'] }, { memoryDir: tmpDir })
    const c = await fs.readFile(path.join(tmpDir, '聊天流式链路.md'), 'utf-8')
    assert.ok(c.includes('autoSkill: commit, verify'))
  })

  test('目录不存在时自动创建', async () => {
    const nested = path.join(tmpDir, 'a', 'b', 'c')
    const r = await writeMemory(valid, { memoryDir: nested })
    assert.ok(r.ok, r.reason)
    assert.ok(await fs.readdir(nested))
  })

  test('写入的 frontmatter 可被 scanMemories 解析（往返一致）', async () => {
    await writeMemory(valid, { memoryDir: tmpDir })
    const entries = await scanMemories(tmpDir)
    const e = entries.find(x => x.file === '聊天流式链路.md')!
    assert.equal(e.name, valid.name)
    assert.equal(e.description, valid.description)
    assert.equal(e.type, 'project')
  })
})

describe('updateMemoryIndex — 索引纪律', () => {
  test('新建索引带标题', async () => {
    await updateMemoryIndex(tmpDir, 'A', 'a.md', 'desc a')
    const idx = await fs.readFile(path.join(tmpDir, 'MEMORY.md'), 'utf-8')
    assert.ok(idx.startsWith('# MEMORY'))
  })

  test('多条追加不互相覆盖', async () => {
    await updateMemoryIndex(tmpDir, 'A', 'a.md', 'desc a')
    await updateMemoryIndex(tmpDir, 'B', 'b.md', 'desc b')
    await updateMemoryIndex(tmpDir, 'C', 'c.md', 'desc c')
    const idx = await fs.readFile(path.join(tmpDir, 'MEMORY.md'), 'utf-8')
    assert.ok(idx.includes('a.md') && idx.includes('b.md') && idx.includes('c.md'))
  })

  test('同文件原地更新，不追加', async () => {
    await updateMemoryIndex(tmpDir, 'A', 'a.md', '第一版')
    await updateMemoryIndex(tmpDir, 'A', 'a.md', '第二版')
    const idx = await fs.readFile(path.join(tmpDir, 'MEMORY.md'), 'utf-8')
    assert.ok(idx.includes('第二版'))
    assert.ok(!idx.includes('第一版'))
    assert.equal(idx.split('\n').filter(l => l.includes('a.md')).length, 1)
  })

  test('超长简介被截断到 150 字符内', async () => {
    await updateMemoryIndex(tmpDir, 'A', 'a.md', 'x'.repeat(500))
    const idx = await fs.readFile(path.join(tmpDir, 'MEMORY.md'), 'utf-8')
    const line = idx.split('\n').find(l => l.includes('a.md'))!
    assert.ok(line.length <= 150, `实际 ${line.length}`)
    assert.ok(line.endsWith('…'))
  })

  test('超过行数上限时截断并留提示', async () => {
    for (let i = 0; i < MAX_INDEX_LINES + 20; i++) {
      await updateMemoryIndex(tmpDir, `T${i}`, `t${i}.md`, `d${i}`)
    }
    const idx = await fs.readFile(path.join(tmpDir, 'MEMORY.md'), 'utf-8')
    const entries = idx.split('\n').filter(l => l.trim().startsWith('- ['))
    assert.ok(entries.length <= MAX_INDEX_LINES + 1, `实际 ${entries.length}`)
    assert.ok(idx.includes('已截断'), '应留截断说明')
  })
})

describe('looksWorthRemembering — 廉价预筛', () => {
  test('太短的文本不值得', () => {
    assert.ok(!looksWorthRemembering('好的'))
    assert.ok(!looksWorthRemembering(''))
  })

  test('含记忆信号词的文本值得', () => {
    const t = '记住：这个项目的 API 地址在 http://127.0.0.1:8080，以后不要再改端口了。'
    assert.ok(looksWorthRemembering(t))
  })

  test('命中黑名单的不值得', () => {
    const t = '这个函数 query() 定义在 src/engine/index.ts 里，需要记住它的位置以便以后查找。'
    assert.ok(!looksWorthRemembering(t), '代码结构不应被视为值得记忆')
  })

  test('含凭据的不值得（且不应被记录）', () => {
    const t = '记住我的 key 是 sk-abcdefghijklmnopqrstuvwxyz123456，以后直接用它。'
    assert.ok(!looksWorthRemembering(t))
  })

  test('无信号词的普通长文本不值得', () => {
    // 预筛刻意保持宽松（宁可交给模型判断，不可漏掉值得记的内容），
    // 因此这里的用例必须真正不含任何信号词。
    const t = '今天天气不错，随便聊了聊最近的新闻和体育赛事，没有别的了，就先这样吧。'
    assert.ok(!looksWorthRemembering(t))
  })
})
