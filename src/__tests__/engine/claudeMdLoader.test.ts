import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  loadInstructions,
  formatInstructionsForPrompt,
  buildInstructionsSection,
  extractIncludeRefs,
  isAllowedIncludeExt,
  enumerateAncestorDirs,
  MAX_INCLUDE_DEPTH,
} from '../../engine/instructions/claudeMdLoader'

/**
 * 这个模块此前完全缺失：KX2API 有 /init 生成 CLAUDE.md，
 * 却没有读取端 —— 用户写的项目约定模型看不到。
 *
 * 同时它也是唯一会去读「用户没直接指定」的文件的地方，
 * 所以 @include 的安全约束是测试重点。
 */

let root: string

async function write(rel: string, content: string): Promise<string> {
  const p = path.join(root, rel)
  await fs.mkdir(path.dirname(p), { recursive: true })
  await fs.writeFile(p, content, 'utf-8')
  return p
}

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'kx2-instr-'))
})

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('extractIncludeRefs', () => {
  it('提取 @path 引用', () => {
    expect(extractIncludeRefs('见 @docs/setup.md 的说明')).toEqual(['docs/setup.md'])
  })

  it('行首引用', () => {
    expect(extractIncludeRefs('@README.md')).toEqual(['README.md'])
  })

  it('忽略代码围栏内的引用（代码里的 @ 不是文件）', () => {
    const md = ['正常 @a.md', '```', '@b.md', '```', '又正常 @c.md'].join('\n')
    expect(extractIncludeRefs(md)).toEqual(['a.md', 'c.md'])
  })

  it('忽略行内代码里的引用', () => {
    expect(extractIncludeRefs('用 `@decorator` 装饰')).toEqual([])
  })

  it('转义的 @ 不算引用', () => {
    expect(extractIncludeRefs('邮箱 a\\@b.com')).toEqual([])
  })

  it('多个引用', () => {
    expect(extractIncludeRefs('@a.md 和 @b.md')).toEqual(['a.md', 'b.md'])
  })

  it('无引用返回空', () => {
    expect(extractIncludeRefs('普通文本')).toEqual([])
  })
})

describe('isAllowedIncludeExt — 扩展名白名单', () => {
  it('文本类扩展名放行', () => {
    for (const f of ['a.md', 'a.txt', 'a.ts', 'a.py', 'a.json', 'a.yaml', 'a.sh', 'a.sql']) {
      expect(isAllowedIncludeExt(f)).toBe(true)
    }
  })

  it('凭据类扩展名一律拒绝', () => {
    for (const f of ['id.pem', 'key.key', 'cert.p12', 'a.pfx', 'secret.env', 'a.keystore']) {
      expect(isAllowedIncludeExt(f)).toBe(false)
    }
  })

  it('无扩展名默认拒绝（除已知约定文件名）', () => {
    expect(isAllowedIncludeExt('somebinary')).toBe(false)
    expect(isAllowedIncludeExt('Makefile')).toBe(true)
    expect(isAllowedIncludeExt('Dockerfile')).toBe(true)
  })

  it('大小写不敏感', () => {
    expect(isAllowedIncludeExt('A.MD')).toBe(true)
  })
})

describe('enumerateAncestorDirs', () => {
  it('由近到远枚举，末项为盘根', async () => {
    const nested = path.join(root, 'a', 'b')
    await fs.mkdir(nested, { recursive: true })
    const dirs = enumerateAncestorDirs(nested)
    expect(dirs[0]).toBe(path.resolve(nested))
    expect(dirs.length).toBeGreaterThan(2)
    // 最后一项的父目录等于自己（盘根）
    const last = dirs[dirs.length - 1]
    expect(path.dirname(last)).toBe(last)
  })

  it('无重复项', () => {
    const dirs = enumerateAncestorDirs(root)
    expect(new Set(dirs).size).toBe(dirs.length)
  })
})

describe('loadInstructions — 逐级向上查找', () => {
  it('加载工作目录的 CLAUDE.md', async () => {
    const dir = path.join(root, 'p1')
    await write('p1/CLAUDE.md', '# 项目约定\n\n用 pnpm。')
    const files = await loadInstructions({ cwd: dir, includeUserLevel: false, resolveIncludes: false })
    expect(files.length).toBe(1)
    expect(files[0].content).toContain('用 pnpm')
    expect(files[0].source).toBe('project')
    expect(files[0].depth).toBe(0)
  })

  it('同时加载父目录的 CLAUDE.md（子目录工作时父级约定仍生效）', async () => {
    const dir = path.join(root, 'p2', 'sub')
    await write('p2/CLAUDE.md', '父级约定')
    await write('p2/sub/CLAUDE.md', '子级约定')
    const files = await loadInstructions({ cwd: dir, includeUserLevel: false, resolveIncludes: false })
    const texts = files.map(f => f.content)
    expect(texts).toContain('父级约定')
    expect(texts).toContain('子级约定')
  })

  it('越靠近工作目录的越靠后（优先级越高）', async () => {
    const dir = path.join(root, 'p3', 'sub')
    await write('p3/CLAUDE.md', '父级')
    await write('p3/sub/CLAUDE.md', '子级')
    const files = await loadInstructions({ cwd: dir, includeUserLevel: false, resolveIncludes: false })
    expect(files[files.length - 1].content).toBe('子级')
  })

  it('本地覆盖文件加载在项目文件之后（优先级最高）', async () => {
    const dir = path.join(root, 'p4')
    await write('p4/CLAUDE.md', '项目级')
    await write('p4/CLAUDE.local.md', '本地覆盖')
    const files = await loadInstructions({ cwd: dir, includeUserLevel: false, resolveIncludes: false })
    expect(files[files.length - 1].content).toBe('本地覆盖')
    expect(files[files.length - 1].source).toBe('local')
  })

  it('空文件被跳过', async () => {
    const dir = path.join(root, 'p5')
    await write('p5/CLAUDE.md', '   \n  ')
    const files = await loadInstructions({ cwd: dir, includeUserLevel: false, resolveIncludes: false })
    expect(files).toEqual([])
  })

  it('无指令文件时返回空数组（不抛错）', async () => {
    const dir = path.join(root, 'p6-none')
    await fs.mkdir(dir, { recursive: true })
    const files = await loadInstructions({ cwd: dir, includeUserLevel: false, resolveIncludes: false })
    expect(files).toEqual([])
  })

  it('同一文件不重复加载', async () => {
    const dir = path.join(root, 'p7')
    await write('p7/CLAUDE.md', '唯一内容')
    const files = await loadInstructions({ cwd: dir, includeUserLevel: false, resolveIncludes: false })
    const paths = files.map(f => f.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('超长文件被截断并标记', async () => {
    const dir = path.join(root, 'p8')
    await write('p8/CLAUDE.md', 'x'.repeat(5000))
    const files = await loadInstructions({
      cwd: dir,
      includeUserLevel: false,
      resolveIncludes: false,
      maxFileChars: 1000,
    })
    expect(files[0].content.length).toBeLessThan(1100)
    expect(files[0].content).toContain('已截断')
  })
})

describe('@include 展开', () => {
  it('展开项目内的引用文件', async () => {
    const dir = path.join(root, 'inc1')
    await write('inc1/docs/setup.md', '安装步骤内容')
    await write('inc1/CLAUDE.md', '见 @docs/setup.md')
    const files = await loadInstructions({ cwd: dir, includeUserLevel: false })
    expect(files[0].content).toContain('安装步骤内容')
    expect(files[0].includes.length).toBe(1)
  })

  it('嵌套 include 可展开', async () => {
    const dir = path.join(root, 'inc2')
    await write('inc2/c.md', '最深层内容')
    await write('inc2/b.md', '见 @c.md')
    await write('inc2/a.md', '见 @b.md')
    await write('inc2/CLAUDE.md', '见 @a.md')
    const files = await loadInstructions({ cwd: dir, includeUserLevel: false })
    expect(files[0].content).toContain('最深层内容')
  })

  it('超出深度上限时停止展开（防循环）', async () => {
    const dir = path.join(root, 'inc3')
    // 自我引用
    await write('inc3/self.md', '自引用 @self.md')
    await write('inc3/CLAUDE.md', '见 @self.md')
    await expect(
      loadInstructions({ cwd: dir, includeUserLevel: false }),
    ).resolves.toBeDefined()
  })

  it('互相引用不会无限递归', async () => {
    const dir = path.join(root, 'inc4')
    await write('inc4/x.md', 'X 见 @y.md')
    await write('inc4/y.md', 'Y 见 @x.md')
    await write('inc4/CLAUDE.md', '见 @x.md')
    const files = await loadInstructions({ cwd: dir, includeUserLevel: false })
    expect(files.length).toBeGreaterThan(0)
  })

  it('**拒绝**引用项目外的路径（防凭据泄露）', async () => {
    const dir = path.join(root, 'inc5')
    const secret = path.join(root, 'outside-secret.md')
    await fs.writeFile(secret, '这是项目外的秘密', 'utf-8')
    await write('inc5/CLAUDE.md', '见 @../outside-secret.md')
    const files = await loadInstructions({ cwd: dir, includeUserLevel: false })
    expect(files[0].content).not.toContain('项目外的秘密')
  })

  it('**拒绝**引用凭据类扩展名', async () => {
    const dir = path.join(root, 'inc6')
    await write('inc6/id.pem', 'PRIVATE KEY MATERIAL')
    await write('inc6/CLAUDE.md', '见 @id.pem')
    const files = await loadInstructions({ cwd: dir, includeUserLevel: false })
    expect(files[0].content).not.toContain('PRIVATE KEY')
  })

  it('引用的文件不存在时保留原文引用（不崩）', async () => {
    const dir = path.join(root, 'inc7')
    await write('inc7/CLAUDE.md', '见 @not-exist.md')
    const files = await loadInstructions({ cwd: dir, includeUserLevel: false })
    expect(files[0].content).toContain('@not-exist.md')
  })

  it('resolveIncludes=false 时不展开', async () => {
    const dir = path.join(root, 'inc8')
    await write('inc8/docs/a.md', '不该出现的内容')
    await write('inc8/CLAUDE.md', '见 @docs/a.md')
    const files = await loadInstructions({ cwd: dir, includeUserLevel: false, resolveIncludes: false })
    expect(files[0].content).not.toContain('不该出现的内容')
    expect(files[0].content).toContain('@docs/a.md')
  })

  it('展开结果带来源标注', async () => {
    const dir = path.join(root, 'inc9')
    await write('inc9/docs/a.md', '引用内容')
    await write('inc9/CLAUDE.md', '见 @docs/a.md')
    const files = await loadInstructions({ cwd: dir, includeUserLevel: false })
    expect(files[0].content).toContain('引自')
  })

  it('MAX_INCLUDE_DEPTH 常量为 5', () => {
    expect(MAX_INCLUDE_DEPTH).toBe(5)
  })
})

describe('合计预算', () => {
  it('超出合计上限时丢弃低优先级内容', async () => {
    const dir = path.join(root, 'budget', 'sub')
    await write('budget/CLAUDE.md', 'A'.repeat(2000))
    await write('budget/sub/CLAUDE.md', 'B'.repeat(2000))
    const files = await loadInstructions({
      cwd: dir,
      includeUserLevel: false,
      resolveIncludes: false,
      maxTotalChars: 2500,
    })
    // 只保留一份（靠近工作目录的那份）
    expect(files.length).toBe(1)
    expect(files[0].content).toBe('B'.repeat(2000))
  })
})

describe('formatInstructionsForPrompt', () => {
  it('空数组返回 null', () => {
    expect(formatInstructionsForPrompt([])).toBeNull()
  })

  it('包含来源路径与内容', async () => {
    const dir = path.join(root, 'fmt1')
    await write('fmt1/CLAUDE.md', '格式约定内容')
    const files = await loadInstructions({ cwd: dir, includeUserLevel: false, resolveIncludes: false })
    const text = formatInstructionsForPrompt(files)!
    expect(text).toContain('CLAUDE.md')
    expect(text).toContain('格式约定内容')
    expect(text).toContain('优先于你的默认习惯')
  })

  it('标注来源层级', async () => {
    const dir = path.join(root, 'fmt2')
    await write('fmt2/CLAUDE.md', '项目')
    await write('fmt2/CLAUDE.local.md', '本地')
    const files = await loadInstructions({ cwd: dir, includeUserLevel: false, resolveIncludes: false })
    const text = formatInstructionsForPrompt(files)!
    expect(text).toContain('项目')
    expect(text).toContain('本地覆盖')
  })
})

describe('buildInstructionsSection — 一步到位', () => {
  it('无指令时返回 null', async () => {
    const dir = path.join(root, 'none2')
    await fs.mkdir(dir, { recursive: true })
    expect(await buildInstructionsSection({ cwd: dir, includeUserLevel: false })).toBeNull()
  })

  it('有指令时返回可注入文本', async () => {
    const dir = path.join(root, 'sec1')
    await write('sec1/CLAUDE.md', '构建命令是 npm run build')
    const text = await buildInstructionsSection({ cwd: dir, includeUserLevel: false })
    expect(text).toContain('构建命令是 npm run build')
  })

  it('目录不可读时静默降级为 null', async () => {
    const text = await buildInstructionsSection({ cwd: '\u0000invalid\u0000' })
    expect(text).toBeNull()
  })
})

describe('用户级指令', () => {
  it('用户级内容排在最前（项目约定可覆盖它）', async () => {
    const dir = path.join(root, 'user1')
    const cfgDir = path.join(root, 'usercfg')
    await write('user1/CLAUDE.md', '项目约定')
    await fs.mkdir(cfgDir, { recursive: true })
    await fs.writeFile(path.join(cfgDir, 'CLAUDE.md'), '全局约定', 'utf-8')

    const files = await loadInstructions({
      cwd: dir,
      userConfigDir: cfgDir,
      includeUserLevel: true,
      resolveIncludes: false,
    })
    expect(files[0].content).toBe('全局约定')
    expect(files[0].source).toBe('user')
    expect(files[files.length - 1].content).toBe('项目约定')
  })

  it('includeUserLevel=false 时不加载全局', async () => {
    const dir = path.join(root, 'user2')
    const cfgDir = path.join(root, 'usercfg2')
    await write('user2/CLAUDE.md', '项目')
    await fs.mkdir(cfgDir, { recursive: true })
    await fs.writeFile(path.join(cfgDir, 'CLAUDE.md'), '全局', 'utf-8')

    const files = await loadInstructions({
      cwd: dir,
      userConfigDir: cfgDir,
      includeUserLevel: false,
      resolveIncludes: false,
    })
    expect(files.some(f => f.content === '全局')).toBe(false)
  })
})
