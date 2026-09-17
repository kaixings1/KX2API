import { describe, it, expect } from 'vitest'
import {
  repairArgsBySchema,
  repairArgsFromText,
  needsRepair,
} from '../../engine/tool-harness/jsonSchemaRepair'

/**
 * 面向 JSON Schema 的工具参数修复。
 *
 * 背景：`tool-harness/repair/` 里已有一套修复流水线，但其中 6 层按 **Zod** 的
 * `_def.typeName` 判断字段类型，而本项目全程用 **JSON Schema** —— 依赖不匹配，
 * 整条流水线对本项目不生效，这才是它长期是孤儿的根因。
 *
 * 本模块复用其中与 schema 方言无关的 `key-normalize` / `json-repair`，
 * 并用 JSON Schema 重写类型强转、枚举纠错、默认值注入。
 *
 * 价值：模型给出的参数常与 schema 有系统性偏差，这些**都能本地纠正**，
 * 不必让模型重试一轮（每次重试都是一轮 API 调用）。
 */

const readSchema = {
  type: 'object',
  properties: {
    file_path: { type: 'string' },
    offset: { type: 'integer' },
    limit: { type: 'integer', default: 100 },
  },
}

describe('needsRepair 廉价预判', () => {
  it('键名完全匹配时返回 false（不触发修复流程）', () => {
    expect(needsRepair({ file_path: '/a', offset: 1 }, readSchema)).toBe(false)
  })

  it('键名风格不符时返回 true', () => {
    expect(needsRepair({ filePath: '/a' }, readSchema)).toBe(true)
    expect(needsRepair({ FilePath: '/a' }, readSchema)).toBe(true)
  })

  it('schema 无 properties 时返回 false（宁可不修，不要瞎猜）', () => {
    expect(needsRepair({ anything: 1 }, {})).toBe(false)
  })
})

describe('键名归一', () => {
  it('camelCase → snake_case', () => {
    const r = repairArgsBySchema({ filePath: '/a.ts' }, readSchema)
    expect(r.data.file_path).toBe('/a.ts')
    expect(r.repairs.some(x => x.strategy === 'key_normalize')).toBe(true)
  })

  it('大小写不符也能匹配', () => {
    const r = repairArgsBySchema({ File_Path: '/a.ts' }, readSchema)
    expect(r.data.file_path).toBe('/a.ts')
  })

  it('近似键名（Levenshtein）可匹配', () => {
    const r = repairArgsBySchema({ file_pat: '/a.ts' }, readSchema)
    expect(r.data.file_path).toBe('/a.ts')
  })

  it('完全无关的键名保留原样（不误改）', () => {
    const r = repairArgsBySchema({ totally_unrelated: 1 }, readSchema)
    expect(r.data.totally_unrelated).toBe(1)
    expect(r.data.file_path).toBeUndefined()
  })
})

describe('类型强转', () => {
  it('字符串布尔 → 布尔', () => {
    const schema = { type: 'object', properties: { recursive: { type: 'boolean' } } }
    for (const raw of ['true', 'TRUE', 'yes', '1', 'on']) {
      const r = repairArgsBySchema({ recursive: raw }, schema)
      expect(r.data.recursive).toBe(true)
    }
    const r2 = repairArgsBySchema({ recursive: 'false' }, schema)
    expect(r2.data.recursive).toBe(false)
  })

  it('无法识别的字符串不被强转（宁可不改，不要猜错）', () => {
    const schema = { type: 'object', properties: { recursive: { type: 'boolean' } } }
    const r = repairArgsBySchema({ recursive: 'maybe' }, schema)
    expect(r.data.recursive).toBe('maybe')
    expect(r.repairs).toHaveLength(0)
  })

  it('字符串数字 → 数字', () => {
    const r = repairArgsBySchema({ offset: '42' }, readSchema)
    expect(r.data.offset).toBe(42)
  })

  it('integer 类型截断小数', () => {
    const r = repairArgsBySchema({ offset: '42.9' }, readSchema)
    expect(r.data.offset).toBe(42)
  })

  it('数字 → 字符串（模型把手写 id 当数字）', () => {
    const schema = { type: 'object', properties: { id: { type: 'string' } } }
    const r = repairArgsBySchema({ id: 12345 }, schema)
    expect(r.data.id).toBe('12345')
  })

  it('单值 → 数组', () => {
    const schema = { type: 'object', properties: { tags: { type: 'array' } } }
    const r = repairArgsBySchema({ tags: 'a' }, schema)
    expect(r.data.tags).toEqual(['a'])
  })

  it('已是数组时不重复包裹', () => {
    const schema = { type: 'object', properties: { tags: { type: 'array' } } }
    const r = repairArgsBySchema({ tags: ['a'] }, schema)
    expect(r.data.tags).toEqual(['a'])
    expect(r.repairs).toHaveLength(0)
  })
})

describe('枚举纠错', () => {
  const schema = {
    type: 'object',
    properties: { mode: { type: 'string', enum: ['Read', 'Write', 'Append'] } },
  }

  it('大小写不符可纠正', () => {
    const r = repairArgsBySchema({ mode: 'read' }, schema)
    expect(r.data.mode).toBe('Read')
    expect(r.repairs[0].strategy).toBe('enum')
  })

  it('首尾空白可纠正', () => {
    const r = repairArgsBySchema({ mode: '  Write ' }, schema)
    expect(r.data.mode).toBe('Write')
  })

  it('不在枚举内时保持原样（不强行塞一个值进去）', () => {
    const r = repairArgsBySchema({ mode: 'Delete' }, schema)
    expect(r.data.mode).toBe('Delete')
    expect(r.repairs).toHaveLength(0)
  })
})

describe('默认值注入', () => {
  it('只补 schema 声明了 default 的缺失字段', () => {
    const r = repairArgsBySchema({ file_path: '/a' }, readSchema)
    expect(r.data.limit).toBe(100)
    // offset 无 default，不应被凭空补上
    expect('offset' in r.data).toBe(false)
  })

  it('已有值时不覆盖', () => {
    const r = repairArgsBySchema({ file_path: '/a', limit: 5 }, readSchema)
    expect(r.data.limit).toBe(5)
  })
})

describe('repairArgsFromText —— JSON 文本修复', () => {
  it('修复 markdown 围栏包裹的 JSON', () => {
    const r = repairArgsFromText('```json\n{"a": 1}\n```')
    expect(r?.data).toEqual({ a: 1 })
  })

  it('修复尾随逗号', () => {
    const r = repairArgsFromText('{"a": 1,}')
    expect(r?.data).toEqual({ a: 1 })
  })

  it('数组结果中取第一个对象', () => {
    const r = repairArgsFromText('[{"a": 1}]')
    expect(r?.data).toEqual({ a: 1 })
  })

  it('完全无法修复时返回 null', () => {
    expect(repairArgsFromText('not json at all !!!')).toBeNull()
  })
})

describe('健壮性', () => {
  it('不改入参', () => {
    const input = { filePath: '/a.ts' }
    const snapshot = JSON.stringify(input)
    repairArgsBySchema(input, readSchema)
    expect(JSON.stringify(input)).toBe(snapshot)
  })

  it('空 schema 不崩且原样返回', () => {
    const r = repairArgsBySchema({ a: 1 }, {})
    expect(r.data).toEqual({ a: 1 })
  })

  it('空参数不崩', () => {
    expect(() => repairArgsBySchema({}, readSchema)).not.toThrow()
  })

  it('多个修复可同时生效', () => {
    const r = repairArgsBySchema({ filePath: '/a.ts', offset: '10' }, readSchema)
    expect(r.data.file_path).toBe('/a.ts')
    expect(r.data.offset).toBe(10)
    expect(r.data.limit).toBe(100)
    expect(r.repairs.length).toBeGreaterThanOrEqual(3)
  })
})
