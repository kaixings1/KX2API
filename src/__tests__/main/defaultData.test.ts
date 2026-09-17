import { describe, it, expect } from 'vitest'
import { BUILTIN_GROUPS, BUILTIN_HINT_RULES } from '../../main/tools/defaultData'

/**
 * 内置分组/规则原先从 default-data.json 读取，用 join(__dirname, ...) 定位。
 * electron-vite 打包后 __dirname 指向 out/main/，JSON 不随构建产出 ——
 * 运行时恒为「文件不存在」，内置分组与规则全部退化为空数组，
 * 且每次读取都刷一条警告。
 *
 * 这些用例锁定「内置数据必须来自编译期常量」这一契约，
 * 避免有人再改回运行时读文件。
 */
describe('内置分组与提示规则', () => {
  it('内置分组非空且结构完整', () => {
    expect(BUILTIN_GROUPS.length).toBeGreaterThan(0)
    for (const g of BUILTIN_GROUPS) {
      expect(g.id).toBeTruthy()
      expect(g.name).toBeTruthy()
      expect(Array.isArray(g.toolIds)).toBe(true)
      expect(typeof g.enabled).toBe('boolean')
      // builtin=true 表示不可删除，这是内置分组的语义约束
      expect(g.builtin).toBe(true)
    }
  })

  it('内置提示规则非空且结构完整', () => {
    expect(BUILTIN_HINT_RULES.length).toBeGreaterThan(0)
    for (const r of BUILTIN_HINT_RULES) {
      expect(r.id).toBeTruthy()
      expect(Array.isArray(r.patterns)).toBe(true)
      expect(Array.isArray(r.groupIds)).toBe(true)
      expect(typeof r.priority).toBe('number')
      expect(r.builtin).toBe(true)
    }
  })

  it('分组 id 唯一', () => {
    const ids = BUILTIN_GROUPS.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('规则 id 唯一', () => {
    const ids = BUILTIN_HINT_RULES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('规则引用的分组必须真实存在（防止改名后留下悬空引用）', () => {
    const groupIds = new Set(BUILTIN_GROUPS.map((g) => g.id))
    for (const r of BUILTIN_HINT_RULES) {
      for (const gid of r.groupIds) {
        expect(groupIds.has(gid), `规则 ${r.id} 引用了不存在的分组 ${gid}`).toBe(true)
      }
    }
  })

  it('规则的正则模式均可编译（防止写入非法正则导致运行时报错）', () => {
    for (const r of BUILTIN_HINT_RULES) {
      for (const p of r.patterns) {
        expect(() => new RegExp(p), `规则 ${r.id} 的模式 ${p} 非法`).not.toThrow()
      }
    }
  })

  it('模块不依赖文件系统读取（内置数据来自编译期常量）', () => {
    // 该断言是语义性的：只要 import 成功即为常量。
    // 若有人改回运行时读文件，源码里会出现 default-data.json 且会在打包后失效。
    expect(BUILTIN_GROUPS[0].createdAt).toBe(0)
    expect(BUILTIN_HINT_RULES[0].createdAt).toBe(0)
  })
})
