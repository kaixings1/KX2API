import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRepoMap, SYMBOL_REGEX } from '../../engine/repoMap'

/**
 * 仓库符号索引（PageRank 排序）。
 *
 * 排查时发现一个**被静默吞掉的真实 bug**：
 *   `walk()` 里把 `readdir` 的结果 map 成 `{ name, isFile }`（isFile 是**布尔值**），
 *   随后却调用 `entry.isFile()` —— 抛 TypeError 后被 `catch { return }` 吞掉，
 *   表现为「一个文件都没遍历就返回空数组」，整个 repoMap **恒返回 0 符号**
 *   且没有任何报错线索。
 *
 * 这些用例用临时目录跑真实 IO，确保扫描链路真的走通（而不是"不报错"就等于对）。
 */
function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'kx2-repomap-'))
  mkdirSync(join(dir, 'sub'), { recursive: true })
  writeFileSync(
    join(dir, 'a.ts'),
    [
      'export function alpha() { return 1 }',
      'export class Beta {}',
      'export interface Gamma {}',
      'const delta = 1',
    ].join('\n'),
    'utf-8',
  )
  writeFileSync(
    join(dir, 'sub', 'b.ts'),
    ['export async function epsilon() {}', 'export type Zeta = string'].join('\n'),
    'utf-8',
  )
  // 应被忽略：非目标扩展名
  writeFileSync(join(dir, 'readme.md'), '# hi', 'utf-8')
  return dir
}

describe('RepoMap 符号提取（真实 IO）', () => {
  it('能扫描到子目录中的符号 —— 回归「walk 被静默吞掉」的 bug', async () => {
    const dir = makeRepo()
    try {
      const map = createRepoMap({ rootDir: dir })
      const symbols = await map.getSymbols()
      // 关键断言：必须有结果。修复前这里恒为 0。
      expect(symbols.length).toBeGreaterThan(0)
      const names = symbols.map(s => s.name)
      expect(names).toContain('alpha')
      expect(names).toContain('Beta')
      expect(names).toContain('Gamma')
      // 子目录里的也要扫到（walk 递归正常）
      expect(names).toContain('epsilon')
      expect(names).toContain('Zeta')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('正确识别符号类型', async () => {
    const dir = makeRepo()
    try {
      const map = createRepoMap({ rootDir: dir })
      const symbols = await map.getSymbols()
      const kindOf = (n: string) => symbols.find(s => s.name === n)?.kind
      expect(kindOf('alpha')).toBe('function')
      expect(kindOf('Beta')).toBe('class')
      expect(kindOf('Gamma')).toBe('interface')
      expect(kindOf('delta')).toBe('const')
      expect(kindOf('Zeta')).toBe('type')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('记录符号所在文件与行号', async () => {
    const dir = makeRepo()
    try {
      const map = createRepoMap({ rootDir: dir })
      const symbols = await map.getSymbols()
      const alpha = symbols.find(s => s.name === 'alpha')
      expect(alpha?.line).toBe(1)
      expect(alpha?.file).toContain('a.ts')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('不扫描非目标扩展名', async () => {
    const dir = makeRepo()
    try {
      const map = createRepoMap({ rootDir: dir })
      const symbols = await map.getSymbols()
      expect(symbols.every(s => !s.file.endsWith('.md'))).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('目录不存在时返回空数组而不是抛错', async () => {
    const map = createRepoMap({ rootDir: join(tmpdir(), '__no_such_dir_kx2__') })
    await expect(map.getSymbols()).resolves.toEqual([])
  })

  it('rankedTags 有 score 且按分数降序', async () => {
    const dir = makeRepo()
    try {
      const map = createRepoMap({ rootDir: dir })
      const tags = await map.getRankedTags(10)
      expect(tags.length).toBeGreaterThan(0)
      for (const t of tags) {
        expect(typeof t.name).toBe('string')
        expect(typeof t.score).toBe('number')
      }
      const scores = tags.map(t => t.score)
      expect([...scores].sort((a, b) => b - a)).toEqual(scores)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('getRankedTags 的 topN 生效', async () => {
    const dir = makeRepo()
    try {
      const map = createRepoMap({ rootDir: dir })
      expect((await map.getRankedTags(2)).length).toBeLessThanOrEqual(2)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('SYMBOL_REGEX 覆盖的声明形态', () => {
  const match = (line: string) => new RegExp(SYMBOL_REGEX).exec(line)

  it.each([
    ['export function f() {}', 'function', 'f'],
    ['async function g() {}', 'function', 'g'],
    ['export default class C {}', 'class', 'C'],
    ['export interface I {}', 'interface', 'I'],
    ['export type T = string', 'type', 'T'],
    ['const x = 1', 'const', 'x'],
    ['let y = 1', 'let', 'y'],
    ['export enum E {}', 'enum', 'E'],
  ])('识别 %s', (line, kind, name) => {
    const m = match(line)
    expect(m?.[1]).toBe(kind)
    expect(m?.[2]).toBe(name)
  })

  it('不匹配普通表达式', () => {
    expect(match('return foo()')).toBeNull()
    expect(match('// function commented() {}')).toBeNull()
  })
})
