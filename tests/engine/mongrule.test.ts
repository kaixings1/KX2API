/**
 * engine/rules/mongrule 条件求值引擎测试
 *
 * 覆盖 MongoDB 风格操作符：比较、集合、存在性、正则、逻辑组合、分组。
 * 含真实缺陷回归：
 *   $or: [] 返回 true（恒真，等于放行一切）—— 空析取应为 false。
 *
 * 运行：node --import tsx --test tests/engine/mongrule.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { evalCondition, evalConditionValue } from '../../src/engine/rules/mongrule.ts'

describe('evalCondition — 基础比较', () => {
  test('隐式相等', () => {
    assert.equal(evalCondition({ a: 1 }, { a: 1 }), true)
    assert.equal(evalCondition({ a: 1 }, { a: 2 }), false)
    assert.equal(evalCondition({ a: 'x' }, { a: 'x' }), true)
    assert.equal(evalCondition({ a: null }, { a: null }), true)
  })

  test('$eq / $ne', () => {
    assert.equal(evalCondition({ a: 1 }, { a: { $eq: 1 } }), true)
    assert.equal(evalCondition({ a: 1 }, { a: { $ne: 2 } }), true)
    assert.equal(evalCondition({ a: 1 }, { a: { $ne: 1 } }), false)
  })

  test('数值比较 $lt/$lte/$gt/$gte', () => {
    assert.equal(evalCondition({ n: 5 }, { n: { $gt: 3 } }), true)
    assert.equal(evalCondition({ n: 5 }, { n: { $gte: 5 } }), true)
    assert.equal(evalCondition({ n: 5 }, { n: { $lt: 10 } }), true)
    assert.equal(evalCondition({ n: 5 }, { n: { $lte: 5 } }), true)
    assert.equal(evalCondition({ n: 5 }, { n: { $gt: 5 } }), false)
  })

  test('多操作符需同时满足（AND 语义）', () => {
    assert.equal(evalCondition({ n: 5 }, { n: { $gt: 1, $lt: 10 } }), true)
    assert.equal(evalCondition({ n: 5 }, { n: { $gt: 1, $lt: 3 } }), false)
  })
})

describe('嵌套路径与缺失字段', () => {
  test('点号路径取值', () => {
    assert.equal(evalCondition({ a: { b: { c: 7 } } }, { 'a.b.c': 7 }), true)
    assert.equal(evalCondition({ a: { b: { c: 7 } } }, { 'a.b.c': 8 }), false)
  })

  test('缺失路径视为 null', () => {
    assert.equal(evalCondition({}, { missing: null }), true, '缺失字段等于 null')
    assert.equal(evalCondition({}, { missing: 1 }), false)
  })

  test('路径穿过非对象时不抛错', () => {
    assert.doesNotThrow(() => evalCondition({ a: 5 }, { 'a.b.c': 1 }))
    assert.equal(evalCondition({ a: 5 }, { 'a.b.c': 1 }), false)
  })
})

describe('$exists / $type / $size', () => {
  test('$exists 真值与假值', () => {
    assert.equal(evalCondition({ a: 1 }, { a: { $exists: true } }), true)
    assert.equal(evalCondition({}, { a: { $exists: true } }), false)
    assert.equal(evalCondition({}, { a: { $exists: false } }), true)
  })

  test('$type 判定类型', () => {
    assert.equal(evalCondition({ a: 'x' }, { a: { $type: 'string' } }), true)
    assert.equal(evalCondition({ a: 1 }, { a: { $type: 'number' } }), true)
    assert.equal(evalCondition({ a: [] }, { a: { $type: 'array' } }), true)
    assert.equal(evalCondition({ a: null }, { a: { $type: 'null' } }), true)
    assert.equal(evalCondition({ a: {} }, { a: { $type: 'object' } }), true)
  })

  test('$size 匹配数组长度', () => {
    assert.equal(evalCondition({ a: [1, 2, 3] }, { a: { $size: 3 } }), true)
    assert.equal(evalCondition({ a: [1, 2, 3] }, { a: { $size: 2 } }), false)
    assert.equal(evalCondition({ a: 'abc' }, { a: { $size: 3 } }), false, '非数组不匹配 $size')
  })
})

describe('集合操作符 $in/$nin/$all/$elemMatch', () => {
  test('$in 标量与数组', () => {
    assert.equal(evalCondition({ a: 2 }, { a: { $in: [1, 2, 3] } }), true)
    assert.equal(evalCondition({ a: 9 }, { a: { $in: [1, 2, 3] } }), false)
    assert.equal(evalCondition({ a: [1, 5] }, { a: { $in: [5, 6] } }), true, '数组任一命中即可')
  })

  test('$nin 是 $in 的取反', () => {
    assert.equal(evalCondition({ a: 9 }, { a: { $nin: [1, 2] } }), true)
    assert.equal(evalCondition({ a: 1 }, { a: { $nin: [1, 2] } }), false)
  })

  test('$in 非数组参数返回 false', () => {
    assert.equal(evalCondition({ a: 1 }, { a: { $in: 'not-array' } }), false)
  })

  test('$all 要求全部元素被覆盖', () => {
    assert.equal(evalCondition({ a: [1, 2, 3] }, { a: { $all: [1, 3] } }), true)
    assert.equal(evalCondition({ a: [1] }, { a: { $all: [1, 2] } }), false)
    assert.equal(evalCondition({ a: 'x' }, { a: { $all: [1] } }), false, '非数组不匹配 $all')
  })

  test('$elemMatch 数组元素匹配对象条件', () => {
    const obj = { items: [{ id: 1, ok: false }, { id: 2, ok: true }] }
    assert.equal(evalCondition(obj, { items: { $elemMatch: { ok: true } } }), true)
    assert.equal(evalCondition(obj, { items: { $elemMatch: { ok: 'nope' } } }), false)
  })

  test('$elemMatch 支持操作符形式', () => {
    assert.equal(evalCondition({ a: [1, 5, 9] }, { a: { $elemMatch: { $gt: 8 } } }), true)
    assert.equal(evalCondition({ a: [1, 5] }, { a: { $elemMatch: { $gt: 8 } } }), false)
  })
})

describe('$regex / $regexi', () => {
  test('$regex 基本匹配（子串语义）', () => {
    assert.equal(evalCondition({ s: 'hello world' }, { s: { $regex: 'wor' } }), true)
    assert.equal(evalCondition({ s: 'hello' }, { s: { $regex: 'xyz' } }), false)
  })

  test('$regexi 忽略大小写', () => {
    assert.equal(evalCondition({ s: 'Hello' }, { s: { $regexi: 'hello' } }), true)
    assert.equal(evalCondition({ s: 'Hello' }, { s: { $regex: 'hello' } }), false)
  })

  test('非法正则返回 false 而非抛错', () => {
    assert.doesNotThrow(() => evalCondition({ s: 'x' }, { s: { $regex: '([unclosed' } }))
    assert.equal(evalCondition({ s: 'x' }, { s: { $regex: '([unclosed' } }), false)
  })
})

describe('逻辑组合 $and/$or/$nor/$not', () => {
  test('$and 全部满足', () => {
    assert.equal(evalCondition({ a: 1, b: 2 }, { $and: [{ a: 1 }, { b: 2 }] }), true)
    assert.equal(evalCondition({ a: 1, b: 3 }, { $and: [{ a: 1 }, { b: 2 }] }), false)
  })

  test('$or 任一满足', () => {
    assert.equal(evalCondition({ a: 1 }, { $or: [{ a: 1 }, { b: 2 }] }), true)
    assert.equal(evalCondition({ a: 9 }, { $or: [{ a: 1 }, { b: 2 }] }), false)
  })

  test('$or 空数组应为 false（回归：原实现返回 true，等于放行一切）', () => {
    assert.equal(
      evalCondition({ any: 'value' }, { $or: [] }),
      false,
      '空 $or 表示「没有任何条件满足」，必须是 false',
    )
  })

  test('$and 空数组为 true（空合取恒真，符合数理逻辑）', () => {
    assert.equal(evalCondition({}, { $and: [] }), true)
  })

  test('$nor 全部不满足', () => {
    assert.equal(evalCondition({ a: 9 }, { $nor: [{ a: 1 }, { b: 2 }] }), true)
    assert.equal(evalCondition({ a: 1 }, { $nor: [{ a: 1 }, { b: 2 }] }), false)
  })

  test('$nor 空数组应为 true（没有任何条件满足）', () => {
    assert.equal(evalCondition({}, { $nor: [] }), true)
  })

  test('$not 取反', () => {
    assert.equal(evalCondition({ a: 1 }, { $not: { a: 2 } }), true)
    assert.equal(evalCondition({ a: 1 }, { $not: { a: 1 } }), false)
  })

  test('组合嵌套：$and 内含 $or', () => {
    const cond = { $and: [{ a: 1 }, { $or: [{ b: 2 }, { c: 3 }] }] }
    assert.equal(evalCondition({ a: 1, c: 3 }, cond), true)
    assert.equal(evalCondition({ a: 1, b: 9 }, cond), false)
  })
})

describe('savedGroups 分组', () => {
  const groups = { beta: ['u1', 'u2'] }

  test('$inGroup 命中分组', () => {
    assert.equal(evalCondition({ id: 'u1' }, { id: { $inGroup: 'beta' } }, groups), true)
    assert.equal(evalCondition({ id: 'u9' }, { id: { $inGroup: 'beta' } }, groups), false)
  })

  test('$notInGroup 取反', () => {
    assert.equal(evalCondition({ id: 'u9' }, { id: { $notInGroup: 'beta' } }, groups), true)
  })

  test('未知分组名视为空列表（不抛错）', () => {
    assert.equal(evalCondition({ id: 'u1' }, { id: { $inGroup: '不存在' } }, groups), false)
  })
})

describe('evalConditionValue — 裸值与数组', () => {
  test('字符串/数字/布尔/null 隐式比较', () => {
    assert.equal(evalConditionValue('x', 'x', {}), true)
    assert.equal(evalConditionValue(1, 1, {}), true)
    assert.equal(evalConditionValue(true, true, {}), true)
    assert.equal(evalConditionValue(null, null, {}), true)
  })

  test('数组按 JSON 深比较', () => {
    assert.equal(evalConditionValue([1, 2], [1, 2], {}), true)
    assert.equal(evalConditionValue([1, 2], [2, 1], {}), false)
  })

  test('布尔条件对 null 值不成立', () => {
    assert.equal(evalConditionValue(false, null, {}), false, 'null 不等于 false')
  })
})
