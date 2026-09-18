/**
 * engine/utils/helpers 与 debug 测试
 *
 * 含真实缺陷回归：
 *   1. promiseTimeout 的 setTimeout 句柄从未被 clear —— 原写法把清理函数
 *      `return` 在 Promise 执行器里，而 Promise 构造器会**忽略执行器返回值**，
 *      于是 promise 先完成时定时器仍存活到超时（拖住进程、且超时后
 *      对一个已 settle 的 promise 再 reject）。
 *   2. chooseVariation 用 parseInt(hex) 解析哈希，收到非 hex 串时 bucket 为 NaN，
 *      最终返回 NaN（索引越界）而非 -1。
 *   3. utils.chooseVariation / inNamespace 与 featureFlag/hash.ts 同名但语义不同，
 *      这里锁定 utils 版自身的契约。
 *
 * 运行：node --import tsx --test tests/engine/utils-helpers.test.ts
 */
import { test, describe, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import {
  hash,
  inRange,
  inNamespace,
  chooseVariation,
  promiseTimeout,
  paddedVersionString,
} from '../../src/engine/utils/helpers.ts'
import { getMinDebugLogLevel, isDebugMode } from '../../src/engine/utils/debug.ts'

describe('hash — djb2', () => {
  test('确定性', () => {
    assert.equal(hash('abc'), hash('abc'))
  })

  test('返回非负 32 位整数', () => {
    for (const s of ['', 'a', 'hello', '中文测试', '🙂']) {
      const h = hash(s)
      assert.ok(Number.isInteger(h))
      assert.ok(h >= 0 && h <= 0xffffffff, `${s} → ${h}`)
    }
  })

  test('不同输入产生不同值（抽样）', () => {
    const set = new Set<number>()
    for (let i = 0; i < 300; i++) set.add(hash(`k${i}`))
    assert.ok(set.size > 295, `碰撞过多：${300 - set.size}`)
  })
})

describe('inRange / inNamespace', () => {
  test('inRange 闭区间', () => {
    assert.equal(inRange(5, 1, 10), true)
    assert.equal(inRange(1, 1, 10), true)
    assert.equal(inRange(10, 1, 10), true)
    assert.equal(inRange(0, 1, 10), false)
  })

  test('inNamespace 精确匹配或点号前缀', () => {
    assert.equal(inNamespace('a.b', ['a']), true)
    assert.equal(inNamespace('a', ['a']), true)
    assert.equal(inNamespace('ab', ['a']), false, '不得把 ab 误判为 a 的子项')
    assert.equal(inNamespace('x', ['a', 'b']), false)
  })
})

describe('chooseVariation', () => {
  test('非法参数返回 -1', () => {
    assert.equal(chooseVariation(0, 0.5, 'ff000000'), -1)
    assert.equal(chooseVariation(3, 0, 'ff000000'), -1)
  })

  test('hex 哈希在 coverage=1 时索引落在 [0,n)', () => {
    for (let i = 0; i < 50; i++) {
      const h = (i * 0x01020304).toString(16).padStart(8, '0')
      const idx = chooseVariation(3, 1, h)
      assert.ok(idx >= 0 && idx < 3, `索引越界：${idx}（hash=${h}）`)
    }
  })

  test('非 hex 哈希输入不得返回 NaN（回归）', () => {
    // 十进制数字串（featureFlag 的 hash() 产出形式）
    const idx = chooseVariation(3, 1, '1234567890')
    assert.ok(
      Number.isInteger(idx) && idx >= -1 && idx < 3,
      `非 hex 输入应返回合法索引或 -1，实际 ${idx}`,
    )
  })

  test('确定性', () => {
    assert.equal(chooseVariation(2, 0.5, 'deadbeef'), chooseVariation(2, 0.5, 'deadbeef'))
  })
})

describe('promiseTimeout', () => {
  const origClear = globalThis.clearTimeout
  let cleared: number[] = []

  afterEach(() => {
    globalThis.clearTimeout = origClear
    cleared = []
  })

  test('promise 正常完成时返回值正确', async () => {
    const v = await promiseTimeout(Promise.resolve('ok'), 1000)
    assert.equal(v, 'ok')
  })

  test('超时抛出带 label 的错误', async () => {
    const never = new Promise<string>(() => {})
    await assert.rejects(
      () => promiseTimeout(never, 30, '读取配置'),
      (e: Error) => e.message.includes('读取配置') && e.message.includes('30'),
    )
  })

  test('promise 先完成时必须清理定时器（回归：句柄泄漏）', async () => {
    // 拦截 clearTimeout 观察是否被调用
    cleared = []
    const spy = ((id?: number) => {
      cleared.push(Number(id))
      return origClear(id as never)
    }) as typeof clearTimeout
    globalThis.clearTimeout = spy

    await promiseTimeout(Promise.resolve(1), 5000)
    assert.ok(cleared.length >= 1, 'promise 完成后应调用 clearTimeout 释放定时器')
  })

  test('超时后原始 promise 完成不再影响结果', async () => {
    let resolveLate: (v: string) => void = () => {}
    const late = new Promise<string>((r) => { resolveLate = r })
    await assert.rejects(() => promiseTimeout(late, 20, 'late'))
    resolveLate('太晚了') // 不应抛未处理 rejection
    await new Promise((r) => setTimeout(r, 10))
  })
})

describe('paddedVersionString', () => {
  test('各段补齐到 4 位', () => {
    assert.equal(paddedVersionString('1.2.3'), '0001.0002.0003')
  })

  test('补齐后可字符串比较（语义比较）', () => {
    assert.ok(paddedVersionString('1.10.0') > paddedVersionString('1.9.0'))
  })

  test('位数相同保持原样', () => {
    assert.equal(paddedVersionString('1234.5678'), '1234.5678')
  })
})

describe('debug — 环境判定', () => {
  test('getMinDebugLogLevel 缺省 debug', () => {
    const saved = process.env.CLAUDE_CODE_DEBUG_LOG_LEVEL
    delete process.env.CLAUDE_CODE_DEBUG_LOG_LEVEL
    assert.equal(getMinDebugLogLevel(), 'debug')
    if (saved !== undefined) process.env.CLAUDE_CODE_DEBUG_LOG_LEVEL = saved
  })

  test('getMinDebugLogLevel 接受合法值', () => {
    const saved = process.env.CLAUDE_CODE_DEBUG_LOG_LEVEL
    process.env.CLAUDE_CODE_DEBUG_LOG_LEVEL = 'WARN'
    assert.equal(getMinDebugLogLevel(), 'warn')
    process.env.CLAUDE_CODE_DEBUG_LOG_LEVEL = '不存在的级别'
    assert.equal(getMinDebugLogLevel(), 'debug', '非法值应回落默认')
    if (saved === undefined) delete process.env.CLAUDE_CODE_DEBUG_LOG_LEVEL
    else process.env.CLAUDE_CODE_DEBUG_LOG_LEVEL = saved
  })

  test('isDebugMode 返回布尔', () => {
    assert.equal(typeof isDebugMode(), 'boolean')
  })
})
