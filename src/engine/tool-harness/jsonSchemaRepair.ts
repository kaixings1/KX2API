/**
 * engine/tool-harness/jsonSchemaRepair.ts — 面向 JSON Schema 的工具参数修复
 *
 * ─────────────────────────────────────────────────────────────
 * 为什么需要这个文件
 * ─────────────────────────────────────────────────────────────
 * `tool-harness/repair/` 下已有一套修复流水线（key-normalize / coerce / fuzzy-enum /
 * synonym / semantic / defaults），但其中 **6 层按 Zod 的 `_def.typeName`
 * 判断字段类型**（`isZodNumber` / `isZodBoolean` / `isZodArray`），
 * 而本项目全程使用 **JSON Schema**（`{ type: 'string' }`）。
 * 依赖不匹配 → 这些层对本项目**完全不生效**，整条流水线也就没人调用
 * —— 这正是 `tool-harness/` 长期是孤儿的根因。
 *
 * 本文件做的是**适配**而非重写：
 * - 复用 `key-normalize`（它只做键名匹配，本就与 schema 方言无关）
 * - 复用 `json-repair`（纯文本修复，与 schema 无关）
 * - 用 JSON Schema 重写「类型强转」「默认值注入」「枚举纠错」这三件最有用的事
 *
 * ─────────────────────────────────────────────────────────────
 * 为什么值得做
 * ─────────────────────────────────────────────────────────────
 * 模型给出的工具参数常与 schema 有系统性偏差：
 * - 键名风格不符：`filePath` / `file_path` / `FilePath`
 * - 类型不符：布尔写成 `"true"`、数字写成 `"42"`、单值写成非数组
 * - 枚举不符：大小写或近义词偏差（`Read` vs `read`）
 * 这些**全都可以在本地纠正**，不必让模型重试一次（每次重试都是一轮 API 调用）。
 */

import { normalizeKeys } from './repair/key-normalize.js'
import { repairJSON } from './repair/json-repair.js'

export interface SchemaRepairAction {
  field: string
  original: unknown
  repaired: unknown
  /** 修复策略标识，便于统计哪类偏差最常见 */
  strategy: 'key_normalize' | 'coerce' | 'enum' | 'default' | 'json_fix'
}

export interface SchemaRepairResult {
  data: Record<string, unknown>
  repairs: SchemaRepairAction[]
}

/** JSON Schema 字段定义（只取我们用到的子集） */
interface FieldSchema {
  type?: string | string[]
  enum?: unknown[]
  default?: unknown
  items?: FieldSchema
  properties?: Record<string, FieldSchema>
}

const BOOL_MAP: Record<string, boolean> = {
  true: true,
  false: false,
  yes: true,
  no: false,
  '1': true,
  '0': false,
  on: true,
  off: false,
}

/** 取出 schema 的顶层 properties（兼容直接给 properties 或包一层 object） */
function topLevelProperties(schema: Record<string, unknown>): Record<string, FieldSchema> {
  const s = schema as FieldSchema
  if (s.properties && typeof s.properties === 'object') return s.properties
  // 有些调用方直接传 properties 本身
  return schema as Record<string, FieldSchema>
}

/** 字段声明的类型（可能有多个，取第一个非 null 的） */
function declaredType(field: FieldSchema | undefined): string | void {
  if (!field) return void 0
  const t = field.type
  if (typeof t === 'string') return t
  if (Array.isArray(t)) return t.find(x => x !== 'null') ?? void 0
  return void 0
}

/**
 * 修复一段 JSON 文本为参数对象。
 *
 * 用于工具调用参数是「字符串形式的 JSON」且可能带 markdown 围栏、
 * 尾随逗号、单引号等模型常见笔误的场景。
 */
export function repairArgsFromText(raw: string): SchemaRepairResult | null {
  const r = repairJSON(raw)
  if (!r) return null
  return {
    data: r.data,
    repairs: r.repairs.map(x => ({
      field: x.field,
      original: x.original,
      repaired: x.repaired,
      strategy: 'json_fix' as const,
    })),
  }
}

/**
 * 按 JSON Schema 修复参数对象。
 *
 * 执行顺序有讲究：
 *   1. 键名归一 —— 后续步骤都按 schema 的键名找字段，键名不对则一切白搭
 *   2. 类型强转 —— 把 `"42"` 变 42、`"true"` 变 true
 *   3. 枚举纠错 —— 大小写/近义匹配
 *   4. 默认值注入 —— 只补 schema 声明了 default 的缺省项
 *
 * @param input  模型给出的参数
 * @param schema 工具的 JSON Schema
 */
export function repairArgsBySchema(
  input: Record<string, unknown>,
  schema: Record<string, unknown>,
): SchemaRepairResult {
  const repairs: SchemaRepairAction[] = []
  const props = topLevelProperties(schema)
  const schemaKeys = Object.keys(props)

  // ── 1. 键名归一（复用既有实现，它与 schema 方言无关） ──
  let data = { ...input }
  if (schemaKeys.length > 0) {
    const normalized = normalizeKeys(data, schemaKeys)
    data = normalized.data
    for (const r of normalized.repairs) {
      repairs.push({
        field: r.field,
        original: r.original,
        repaired: r.repaired,
        strategy: 'key_normalize',
      })
    }
  }

  // ── 2. 类型强转 + 3. 枚举纠错 ──
  for (const [key, field] of Object.entries(props)) {
    if (!(key in data)) continue
    const value = data[key]
    const type = declaredType(field)

    // 字符串 → 布尔
    if (type === 'boolean' && typeof value === 'string') {
      const mapped = BOOL_MAP[value.toLowerCase().trim()]
      if (mapped !== undefined) {
        data[key] = mapped
        repairs.push({ field: key, original: value, repaired: mapped, strategy: 'coerce' })
        continue
      }
    }

    // 字符串 → 数字（含整数）
    if ((type === 'number' || type === 'integer') && typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed !== '') {
        const num = Number(trimmed)
        if (!Number.isNaN(num)) {
          const coerced = type === 'integer' ? Math.trunc(num) : num
          data[key] = coerced
          repairs.push({
            field: key,
            original: value,
            repaired: coerced,
            strategy: 'coerce',
          })
          continue
        }
      }
    }

    // 数字 → 字符串（模型把手写 id 当数字给出）
    if (type === 'string' && typeof value === 'number') {
      data[key] = String(value)
      repairs.push({
        field: key,
        original: value,
        repaired: String(value),
        strategy: 'coerce',
      })
      continue
    }

    // 单值 → 数组
    if (type === 'array' && !Array.isArray(value) && value !== null && value !== void 0) {
      data[key] = [value]
      repairs.push({
        field: key,
        original: value,
        repaired: [value],
        strategy: 'coerce',
      })
      continue
    }

    // 枚举纠错：精确 → 大小写不敏感 → 去空白
    if (Array.isArray(field.enum) && field.enum.length > 0 && typeof value === 'string') {
      const exact = field.enum.find(e => e === value)
      if (!exact) {
        const lower = value.toLowerCase().trim()
        const ci = field.enum.find(
          e => typeof e === 'string' && e.toLowerCase().trim() === lower,
        )
        if (ci !== undefined) {
          data[key] = ci
          repairs.push({ field: key, original: value, repaired: ci, strategy: 'enum' })
        }
      }
    }
  }

  // ── 4. 默认值注入（只补 schema 明确声明 default 的字段） ──
  for (const [key, field] of Object.entries(props)) {
    if (key in data) continue
    if (field && 'default' in field && field.default !== void 0) {
      data[key] = field.default
      repairs.push({
        field: key,
        original: void 0,
        repaired: field.default,
        strategy: 'default',
      })
    }
  }

  return { data, repairs }
}

/** 参数是否需要修复（廉价预判：键名或类型与 schema 不符） */
export function needsRepair(
  input: Record<string, unknown>,
  schema: Record<string, unknown>,
): boolean {
  const props = topLevelProperties(schema)
  const keys = Object.keys(props)
  if (keys.length === 0) return false

  const keySet = new Set(keys)
  const lowerMap = new Map(keys.map(k => [k.toLowerCase(), k]))

  for (const k of Object.keys(input)) {
    if (keySet.has(k)) continue
    // 键名不在 schema 里 —— 可能是风格差异，值得尝试修复
    if (lowerMap.has(k.toLowerCase())) return true
    // 驼峰/下划线互换
    const snake = k.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
    const camel = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
    if (keySet.has(snake) || keySet.has(camel)) return true
  }
  return false
}
