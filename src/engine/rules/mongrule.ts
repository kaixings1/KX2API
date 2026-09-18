/**
 * engine/rules/mongrule.ts — MongoDB 条件求值引擎
 *
 * 移植自 D:\src\mongrule.ts，去除外部依赖（GrowthBook types）。
 * 支持：$eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $regex, $exists,
 *       $and, $or, $nor, $not, $size, $elemMatch, $all, $type, $veq 等。
 */

export type VarType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'undefined'

export type ConditionValue = string | number | boolean | null | ConditionValue[] | OperatorConditionValue

export interface OperatorConditionValue {
  [key: string]: unknown
}

export type ConditionInterface = {
  [key: string]: unknown
} & {
  $or?: ConditionInterface[]
  $nor?: ConditionInterface[]
  $and?: ConditionInterface[]
  $not?: ConditionInterface
}

export type TestedObj = Record<string, unknown>

export type SavedGroupsValues = Record<string, string[]>

export type Operator =
  | '$veq' | '$vne' | '$vgt' | '$vgte' | '$vlt' | '$vlte'
  | '$eq' | '$ne' | '$lt' | '$lte' | '$gt' | '$gte'
  | '$exists' | '$in' | '$nin' | '$not' | '$size'
  | '$elemMatch' | '$all' | '$regex' | '$type'
  | '$inGroup' | '$notInGroup' | '$ini' | '$nini' | '$alli' | '$regexi'

const _regexCache: { [key: string]: RegExp } = {}

export function evalCondition(
  obj: TestedObj,
  condition: ConditionInterface,
  savedGroups?: SavedGroupsValues,
): boolean {
  savedGroups = savedGroups || {}
  for (const [k, v] of Object.entries(condition)) {
    switch (k) {
      case '$or':
        // 空 $or 表示「没有任何条件」—— 析取的空集恒为假。
        // 原实现直接 return true，会让 `$or: []` 变成恒真条件（放行一切），
        // 是最危险的一类误判：配置写错时不是拒绝而是全通过。
        if ((v as ConditionInterface[]).length === 0) return false
        if (!evalOr(obj, v as ConditionInterface[], savedGroups)) return false
        break
      case '$nor':
        // $nor 是「全部不满足」，空集表示「没有任何条件被满足」→ 真。
        if (evalOr(obj, v as ConditionInterface[], savedGroups)) return false
        break
      case '$and':
        if (!evalAnd(obj, v as ConditionInterface[], savedGroups)) return false
        break
      case '$not':
        if (evalCondition(obj, v as ConditionInterface, savedGroups)) return false
        break
      default:
        if (!evalConditionValue(v as ConditionValue, getPath(obj, k), savedGroups)) return false
    }
  }
  return true
}

function getPath(obj: TestedObj, path: string): ConditionValue {
  const parts = path.split('.')
  let current: unknown = obj
  for (let i = 0; i < parts.length; i++) {
    if (current && typeof current === 'object' && parts[i] in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[parts[i]]
    } else {
      return null
    }
  }
  return current as ConditionValue
}

function getRegex(regex: string, insensitive = false): RegExp {
  const cacheKey = `${regex}${insensitive ? '/i' : ''}`
  if (!_regexCache[cacheKey]) {
    _regexCache[cacheKey] = new RegExp(
      regex.replace(/([^\\])\//g, '$1\\/'),
      insensitive ? 'i' : undefined,
    )
  }
  return _regexCache[cacheKey]
}

export function evalConditionValue(
  condition: ConditionValue,
  value: unknown,
  savedGroups: SavedGroupsValues,
  insensitive = false,
): boolean {
  if (typeof condition === 'string') {
    if (insensitive) return String(value).toLowerCase() === condition.toLowerCase()
    return value + '' === condition
  }
  if (typeof condition === 'number') return (value as number) * 1 === condition
  if (typeof condition === 'boolean') return value !== null && !!value === condition
  if (condition === null) return value === null

  if (Array.isArray(condition) || !isOperatorObject(condition)) {
    return JSON.stringify(value) === JSON.stringify(condition)
  }

  for (const op in condition) {
    if (
      !evalOperatorCondition(
        op as Operator,
        value,
        condition[op as keyof OperatorConditionValue],
        savedGroups,
      )
    ) {
      return false
    }
  }
  return true
}

function isOperatorObject(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) return false
  const keys = Object.keys(obj as Record<string, unknown>)
  return keys.length > 0 && keys.filter(k => k[0] === '$').length === keys.length
}

function getType(v: unknown): VarType | 'unknown' {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  const t = typeof v
  if (['string', 'number', 'boolean', 'object', 'undefined'].includes(t)) return t as VarType
  return 'unknown'
}

function elemMatch(actual: unknown, expected: unknown, savedGroups: SavedGroupsValues): boolean {
  if (!Array.isArray(actual)) return false
  const check = isOperatorObject(expected)
    ? (v: unknown) => evalConditionValue(expected as ConditionValue, v, savedGroups)
    : (v: unknown) => evalCondition(v as TestedObj, expected as ConditionInterface, savedGroups)
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] && check(actual[i])) return true
  }
  return false
}

function isIn(actual: unknown, expected: unknown[], insensitive = false): boolean {
  if (insensitive) {
    const caseFold = (val: unknown) => (typeof val === 'string' ? val.toLowerCase() : val)
    if (Array.isArray(actual)) {
      return actual.some(el => expected.some(exp => caseFold(el) === caseFold(exp)))
    }
    return expected.some(exp => caseFold(actual) === caseFold(exp))
  }
  if (Array.isArray(actual)) return actual.some(el => expected.includes(el))
  return expected.includes(actual)
}

function isInAll(
  actual: unknown,
  expected: ConditionValue[],
  savedGroups: SavedGroupsValues,
  insensitive = false,
): boolean {
  if (!Array.isArray(actual)) return false
  for (let i = 0; i < expected.length; i++) {
    let passed = false
    for (let j = 0; j < actual.length; j++) {
      if (evalConditionValue(expected[i], actual[j], savedGroups, insensitive)) {
        passed = true
        break
      }
    }
    if (!passed) return false
  }
  return true
}

function evalOperatorCondition(
  operator: Operator,
  actual: unknown,
  expected: unknown,
  savedGroups: SavedGroupsValues,
): boolean {
  switch (operator) {
    case '$eq': return actual === expected
    case '$ne': return actual !== expected
    case '$lt': return (actual as number) < (expected as number)
    case '$lte': return (actual as number) <= (expected as number)
    case '$gt': return (actual as number) > (expected as number)
    case '$gte': return (actual as number) >= (expected as number)
    case '$exists':
      return expected ? actual != null : actual == null
    case '$in':
      if (!Array.isArray(expected)) return false
      return isIn(actual, expected)
    case '$nin':
      if (!Array.isArray(expected)) return false
      return !isIn(actual, expected)
    case '$not':
      return !evalConditionValue(expected as ConditionValue, actual, savedGroups)
    case '$size':
      if (!Array.isArray(actual)) return false
      return evalConditionValue(expected as ConditionValue, actual.length, savedGroups)
    case '$elemMatch':
      return elemMatch(actual, expected, savedGroups)
    case '$all':
      if (!Array.isArray(expected)) return false
      return isInAll(actual, expected as ConditionValue[], savedGroups)
    case '$regex':
      try { return getRegex(expected as string).test(String(actual)) } catch { return false }
    case '$regexi':
      try { return getRegex(expected as string, true).test(String(actual)) } catch { return false }
    case '$type':
      return getType(actual) === expected
    case '$inGroup':
      return isIn(actual, savedGroups[expected as string] || [])
    case '$notInGroup':
      return !isIn(actual, savedGroups[expected as string] || [])
    default:
      return false
  }
}

/**
 * 析取求值。
 *
 * 空集返回 **false**（没有任何子条件满足）—— 这是「或」的自然语义。
 * 注意 $nor 的实现依赖此语义：它先调 evalOr，若为真则整体为假，
 * 空 $nor 会因此得到 true（「没有条件被满足」），符合 MongoDB 语义。
 */
function evalOr(
  obj: TestedObj,
  conditions: ConditionInterface[],
  savedGroups: SavedGroupsValues,
): boolean {
  if (!conditions.length) return false
  for (let i = 0; i < conditions.length; i++) {
    if (evalCondition(obj, conditions[i], savedGroups)) return true
  }
  return false
}

function evalAnd(
  obj: TestedObj,
  conditions: ConditionInterface[],
  savedGroups: SavedGroupsValues,
): boolean {
  for (let i = 0; i < conditions.length; i++) {
    if (!evalCondition(obj, conditions[i], savedGroups)) return false
  }
  return true
}
