/**
 * /init 命令单测
 *
 * 覆盖：
 * - 项目扫描（package.json 脚本、包管理器、目录、配置文件）
 * - 自动区块渲染
 * - CLAUDE.md 写入策略：不存在→创建 / 无标记→追加 / 有标记→原地替换且不碰用户内容
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  analyzeProject,
  renderManagedBlock,
  upsertManagedBlock,
  runInit,
  INIT_BLOCK_BEGIN,
  INIT_BLOCK_END,
} from '../init'

let root: string

async function write(rel: string, content: string): Promise<void> {
  const full = join(root, rel)
  await fs.mkdir(join(full, '..'), { recursive: true })
  await fs.writeFile(full, content, 'utf-8')
}

beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'kx2-init-'))
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('analyzeProject', () => {
  it('读取 package.json 的脚本与依赖', async () => {
    await write('package.json', JSON.stringify({
      name: 'demo-app',
      version: '1.2.3',
      description: '演示项目',
      scripts: { dev: 'vite dev', build: 'vite build' },
      dependencies: { react: '^18.0.0' },
      devDependencies: { vitest: '^4.0.0' },
    }))
    const info = await analyzeProject(root)
    expect(info.name).toBe('demo-app')
    expect(info.version).toBe('1.2.3')
    expect(info.description).toBe('演示项目')
    expect(info.scripts.map(s => s.name)).toEqual(['dev', 'build'])
    expect(info.dependencies).toContain('react')
    expect(info.devDependencies).toContain('vitest')
  })

  it('按锁文件识别包管理器', async () => {
    await write('bun.lockb', '')
    expect((await analyzeProject(root)).packageManager).toBe('bun')

    await fs.rm(join(root, 'bun.lockb'))
    await write('pnpm-lock.yaml', '')
    expect((await analyzeProject(root)).packageManager).toBe('pnpm')

    await fs.rm(join(root, 'pnpm-lock.yaml'))
    await write('package-lock.json', '{}')
    expect((await analyzeProject(root)).packageManager).toBe('npm')
  })

  it('列出顶层目录、src 子目录与配置文件，并跳过 node_modules', async () => {
    await write('package.json', '{}')
    await fs.mkdir(join(root, 'src', 'main'), { recursive: true })
    await fs.mkdir(join(root, 'src', 'renderer'), { recursive: true })
    await fs.mkdir(join(root, 'node_modules'), { recursive: true })
    await write('tsconfig.json', '{}')
    await write('electron.vite.config.ts', '')
    const info = await analyzeProject(root)
    expect(info.topLevelDirs).toContain('src')
    expect(info.topLevelDirs).not.toContain('node_modules')
    expect(info.srcDirs).toEqual(['main', 'renderer'])
    expect(info.configFiles).toContain('tsconfig.json')
    expect(info.configFiles).toContain('electron.vite.config.ts')
  })

  it('没有 package.json 也能扫描（回退为未命名项目）', async () => {
    const info = await analyzeProject(root)
    expect(info.name).toBe('(未命名项目)')
    expect(info.scripts).toEqual([])
  })
})

describe('renderManagedBlock', () => {
  it('包含项目信息、命令表格与目录说明', async () => {
    await write('package.json', JSON.stringify({
      name: 'demo-app',
      scripts: { dev: 'vite dev' },
      dependencies: { electron: '^33.0.0' },
    }))
    await fs.mkdir(join(root, 'src', 'main'), { recursive: true })
    const block = renderManagedBlock(await analyzeProject(root))
    expect(block.startsWith(INIT_BLOCK_BEGIN)).toBe(true)
    expect(block.endsWith(INIT_BLOCK_END)).toBe(true)
    expect(block).toContain('demo-app')
    expect(block).toContain('| `npm run dev` | vite dev |')
    expect(block).toContain('`src/main/` — Electron 主进程')
    expect(block).toContain('`electron`')
  })
})

describe('upsertManagedBlock', () => {
  const target = () => join(root, 'CLAUDE.md')
  const block = `${INIT_BLOCK_BEGIN}\n自动内容 v1\n${INIT_BLOCK_END}`

  it('文件不存在 → 创建并写入标题', async () => {
    expect(await upsertManagedBlock(target(), block)).toBe('created')
    const content = await fs.readFile(target(), 'utf-8')
    expect(content).toContain('# CLAUDE')
    expect(content).toContain('自动内容 v1')
  })

  it('文件存在但没有标记 → 追加，保留用户原有内容', async () => {
    await fs.writeFile(target(), '# 我的规则\n\n不要删我\n', 'utf-8')
    expect(await upsertManagedBlock(target(), block)).toBe('appended')
    const content = await fs.readFile(target(), 'utf-8')
    expect(content).toContain('不要删我')
    expect(content).toContain('自动内容 v1')
  })

  it('已有标记 → 原地替换，用户内容不变', async () => {
    await fs.writeFile(
      target(),
      `# 我的规则\n\n上面\n\n${INIT_BLOCK_BEGIN}\n旧内容\n${INIT_BLOCK_END}\n\n下面\n`,
      'utf-8',
    )
    expect(await upsertManagedBlock(target(), block)).toBe('updated')
    const content = await fs.readFile(target(), 'utf-8')
    expect(content).toContain('上面')
    expect(content).toContain('下面')
    expect(content).not.toContain('旧内容')
    expect(content).toContain('自动内容 v1')
    // 只应存在一对标记
    expect(content.split(INIT_BLOCK_BEGIN)).toHaveLength(2)
  })
})

describe('runInit', () => {
  it('扫描指定目录并写出 CLAUDE.md', async () => {
    await write('package.json', JSON.stringify({ name: 'demo-app', scripts: { test: 'vitest run' } }))
    const result = await runInit([root])
    expect(result.success).toBe(true)
    expect(result.output).toContain('/init 完成')
    expect(result.output).toContain('已创建 CLAUDE.md')
    const content = await fs.readFile(join(root, 'CLAUDE.md'), 'utf-8')
    expect(content).toContain('demo-app')
    expect(content).toContain('| `npm run test` | vitest run |')
  })

  it('重复运行只刷新自动区块', async () => {
    await write('package.json', JSON.stringify({ name: 'demo-app' }))
    await runInit([root])
    const first = await fs.readFile(join(root, 'CLAUDE.md'), 'utf-8')
    const second = await runInit([root])
    expect(second.output).toContain('已更新 CLAUDE.md 中的自动区块')
    const content = await fs.readFile(join(root, 'CLAUDE.md'), 'utf-8')
    expect(content.split(INIT_BLOCK_BEGIN)).toHaveLength(2)
    expect(content).toBe(first)
  })
})
