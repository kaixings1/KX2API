/**
 * engine/featureFlag 模块测试
 *
 * 覆盖 murmurHash3、hash 属性、variation 选择、GrowthBook 规则求值。
 *
 * 锁定/暴露的真实缺陷：
 *   1. growthBook.ts 内部 getHashAttribute 用 Math.random() 兜底 ——
 *      同一实例多次求值会得到不同分桶（实验组不稳定，违背 feature flag 基本语义）
 *   2. hash.ts 与 growthBook.ts 各有一套 chooseVariation/isIncluded（重复实现）
 *   3. isIncluded 的 fallbackAttribute 参数从未使用
 *
 * 运行：node --import tsx --test tests/engine/feature-flag.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { murmurHash3, GrowthBook, createGrowthBook } from '../../src/engine/featureFlag/growthBook.ts'
import {
  hash,
  getHashAttribute,
  getStickyBucketAttributeKey,
  inRange,
  inNamespace,
  chooseVariation,
  isIncluded,
} from '../../src/engine/featureFlag/hash.ts'

describe('murmurHash3 — 基本性质', () => {
  test('确定性：同一输入恒得同一结果', () => {
    assert.equal(murmurHash3('hello'), murmurHash3('hello'))
    assert.equal(murmurHash3('用户-123'), murmurHash3('用户-123'))
  })

  test('不同输入产生不同哈希（抽样检查碰撞）', () => {
    const set = new Set<number>()
    for (let i = 0; i < 500; i++) set.add(murmurHash3(`key-${i}`))
    // 500 个不同输入允许极少碰撞，但不应大面积重复
    assert.ok(set.size > 490, `碰撞过多：${500 - set.size} 个`)
  })

  test('返回值非负整数', () => {
    for (const s of ['', 'a', 'abc', '长中文字符串测试', '🙂emoji']) {
      const h = murmurHash3(s)
      assert.ok(Number.isInteger(h), `${s} → ${h} 应为整数`)
      assert.ok(h >= 0, `${s} → ${h} 应为非负`)
    }
  })

  test('空字符串不抛错', () => {
    assert.doesNotThrow(() => murmurHash3(''))
  })
})

describe('hash — 哈希属性', () => {
  test('hash() 返回数字字符串', () => {
    const h = hash('abc')
    assert.equal(typeof h, 'string')
    assert.ok(/^\d+$/.test(h), `hash 应为数字串，实际 ${h}`)
  })

  test('getHashAttribute 有属性时按属性值哈希（确定性）', () => {
    const a = getHashAttribute('id', { id: 'user-1' })
    const b = getHashAttribute('id', { id: 'user-1' })
    assert.equal(a, b, '同一属性值应得同一哈希')
  })

  test('getHashAttribute 缺属性时回落到属性名（确定性，非随机）', () => {
    const a = getHashAttribute('id', {})
    const b = getHashAttribute('id', {})
    assert.equal(a, b, '缺失属性时也必须确定性，否则分桶会漂移')
  })

  test('getStickyBucketAttributeKey 前缀稳定', () => {
    assert.equal(getStickyBucketAttributeKey('exp'), 'sticky_bucket_exp')
  })

  test('inRange / inNamespace 边界', () => {
    assert.equal(inRange(5, 1, 10), true)
    assert.equal(inRange(1, 1, 10), true, '闭区间含下界')
    assert.equal(inRange(10, 1, 10), true, '闭区间含上界')
    assert.equal(inRange(0, 1, 10), false)

    assert.equal(inNamespace('exp', 'exp:1'), true)
    assert.equal(inNamespace('exp', 'exp_1'), true)
    assert.equal(inNamespace('exp', 'other:1'), false)
  })
})

describe('chooseVariation — 分桶', () => {
  test('非法参数返回 -1', () => {
    assert.equal(chooseVariation(0, 1, 'h'), -1)
    assert.equal(chooseVariation(2, 0, 'h'), -1)
    assert.equal(chooseVariation(2, 1.5, 'h'), -1)
  })

  test('coverage=1 时任何人都在实验内，索引落在 [0,n)', () => {
    for (let i = 0; i < 50; i++) {
      const idx = chooseVariation(3, 1, `user-${i}`)
      assert.ok(idx >= 0 && idx < 3, `索引越界：${idx}`)
    }
  })

  test('确定性：同一 hash 恒得同一 variation', () => {
    const a = chooseVariation(2, 0.5, 'stable-key')
    const b = chooseVariation(2, 0.5, 'stable-key')
    assert.equal(a, b)
  })

  test('大覆盖率下 variation 分布大致均匀（不塌缩到单桶）', () => {
    const counts = [0, 0, 0]
    for (let i = 0; i < 3000; i++) {
      const idx = chooseVariation(3, 1, `u-${i}`)
      if (idx >= 0) counts[idx]++
    }
    for (const c of counts) {
      assert.ok(c > 600, `分桶严重不均：${JSON.stringify(counts)}`)
    }
  })
})

describe('isIncluded — 覆盖判定', () => {
  test('coverage<=0 恒排除', () => {
    assert.equal(isIncluded(0, 'x'), false)
    assert.equal(isIncluded(-1, 'x'), false)
  })

  test('确定性', () => {
    assert.equal(isIncluded(0.5, 'k'), isIncluded(0.5, 'k'))
  })

  test('coverage=1 时恒包含', () => {
    for (let i = 0; i < 100; i++) {
      assert.equal(isIncluded(1, `k-${i}`), true)
    }
  })
})

describe('GrowthBook — 规则求值', () => {
  test('未定义的特性返回默认值', () => {
    const gb = createGrowthBook()
    assert.deepEqual(gb.evalFeature('不存在', 'fallback'), { value: 'fallback', source: 'default' })
  })

  test('强制规则 force 直接生效', () => {
    const gb = createGrowthBook({
      features: {
        f: { defaultValue: false, rules: [{ force: true, variations: [] }] },
      },
    })
    assert.equal(gb.isOn('f'), true)
    assert.equal(gb.evalFeature('f', false).source, 'force')
  })

  test('force + coverage=0 时跳过该规则（不生效）', () => {
    const gb = createGrowthBook({
      features: {
        f: { defaultValue: false, rules: [{ force: true, coverage: 0, variations: [] }] },
      },
    })
    assert.equal(gb.isOn('f'), false, 'coverage=0 时强制规则应被跳过')
  })

  test('variations 规则按分桶选取', () => {
    const gb = createGrowthBook({
      attributes: { id: 'user-42' },
      features: {
        f: { defaultValue: 'default', rules: [{ coverage: 1, variations: ['A', 'B'] }] },
      },
    })
    const v = gb.evalFeature('f', 'default')
    assert.ok(['A', 'B'].includes(v.value as string), `实际 ${v.value}`)
    assert.equal(v.source, 'experiment')
  })

  test('同一属性多次求值结果稳定（回归：随机兜底会漂移）', () => {
    const gb = createGrowthBook({
      attributes: { id: 'stable-user' },
      features: {
        f: { defaultValue: 'd', rules: [{ coverage: 1, variations: ['A', 'B', 'C'] }] },
      },
    })
    const first = gb.evalFeature('f', 'd').value
    for (let i = 0; i < 20; i++) {
      assert.equal(gb.evalFeature('f', 'd').value, first, '同一实例多次求值必须稳定')
    }
  })

  test('缺少 hashAttribute 时不得随机漂移（回归：Math.random 兜底）', () => {
    // 不给 attributes，规则用默认 hashAttribute='id'
    const gb = createGrowthBook({
      features: {
        f: { defaultValue: 'd', rules: [{ coverage: 1, variations: ['A', 'B', 'C'] }] },
      },
    })
    const first = gb.evalFeature('f', 'd').value
    for (let i = 0; i < 20; i++) {
      assert.equal(
        gb.evalFeature('f', 'd').value,
        first,
        '缺失 hash 属性时也必须确定性（否则同一用户反复切换实验组）',
      )
    }
  })

  test('isOff 与 isOn 互补', () => {
    const gb = createGrowthBook({
      features: { on: { defaultValue: true, rules: [] } },
    })
    assert.equal(gb.isOn('on'), true)
    assert.equal(gb.isOff('on'), false)
  })

  test('getFeatureValue 返回 value', () => {
    const gb = createGrowthBook({ features: { n: { defaultValue: 7, rules: [] } } })
    assert.equal(gb.getFeatureValue('n', 0), 7)
  })

  test('getFeatures 返回全部特性的求值结果', () => {
    const gb = createGrowthBook({
      features: {
        a: { defaultValue: 1, rules: [] },
        b: { defaultValue: 2, rules: [] },
      },
    })
    const m = gb.getFeatures()
    assert.equal(m.size, 2)
    assert.equal(m.get('a')!.value, 1)
    assert.equal(m.get('b')!.value, 2)
  })

  test('track 不抛错（当前为空实现）', () => {
    const gb = createGrowthBook()
    assert.doesNotThrow(() => gb.track('evt', { a: 1 }))
  })
})
