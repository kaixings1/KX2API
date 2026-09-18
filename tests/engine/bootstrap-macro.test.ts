/**
 * engine/bootstrap 测试
 *
 * 含真实缺陷回归：
 *   getMacroConfig 用 `require('../../package.json')` 读版本 ——
 *   ① 相对路径错了一层（src/engine/bootstrap/ → ../../ 是 src/，
 *      正确应为 ../../../package.json）；
 *   ② ESM 环境下 require 未定义，即便路径对了也读不到。
 *   两个问题叠加的结果是 VERSION 恒为 '0.0.0'，且异常被 catch 静默吞掉。
 *
 * ⚠️ 模块内 macroInitialized 是**进程级一次性**标志：一旦初始化过，
 * 后续调用直接 return（不会因为 globalThis.MACRO 被删掉而重建）。
 * 因此这里不做逐例重置，只依赖进程内首次调用生成的对象做断言。
 *
 * 运行：node --import tsx --test tests/engine/bootstrap-macro.test.ts
 */
import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ensureBootstrapMacro } from '../../src/engine/bootstrap/macro.ts'
import { setup, resetSetupState } from '../../src/engine/bootstrap/setup.ts'
import { getToolResultsDir } from '../../src/engine/toolResultStore.ts'

const pkgVersion = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')).version as string

describe('ensureBootstrapMacro', () => {
  test('调用后 globalThis.MACRO 可用', () => {
    ensureBootstrapMacro()
    const macro = (globalThis as Record<string, unknown>).MACRO as { VERSION?: string } | undefined
    assert.ok(macro, '应设置 globalThis.MACRO')
    assert.equal(typeof macro!.VERSION, 'string')
  })

  test('VERSION 应读到 package.json 的真实版本（回归：路径/require 双重失效）', () => {
    ensureBootstrapMacro()
    const macro = (globalThis as Record<string, unknown>).MACRO as { VERSION: string }
    assert.equal(
      macro.VERSION,
      pkgVersion,
      `VERSION 应等于 package.json 的 ${pkgVersion}，实际 ${macro.VERSION}`,
    )
  })

  test('幂等：重复调用不抛错且对象保持稳定', () => {
    const before = (globalThis as Record<string, unknown>).MACRO
    assert.doesNotThrow(() => ensureBootstrapMacro())
    assert.equal((globalThis as Record<string, unknown>).MACRO, before, '不应被重建')
  })

  test('BUILD_TIME / PACKAGE_URL 透传环境变量', () => {
    const macro = (globalThis as Record<string, unknown>).MACRO as { BUILD_TIME?: string }
    // 未设置时为 undefined，设置时应透传（此处只验证形状）
    assert.ok(macro.BUILD_TIME === undefined || typeof macro.BUILD_TIME === 'string')
  })
})

describe('setup — 引擎启动初始化', () => {
  beforeEach(() => resetSetupState())

  test('首次调用不抛错', async () => {
    await assert.doesNotReject(() => setup())
  })

  test('幂等：同一 sessionId 重复调用不抛错', async () => {
    await setup({ sessionId: 's1' })
    await assert.doesNotReject(() => setup({ sessionId: 's1' }))
  })

  test('初始化后工具结果目录已就绪', async () => {
    await setup({ sessionId: 's-dir' })
    const dir = getToolResultsDir()
    assert.ok(typeof dir === 'string' && dir.length > 0, `应设置落盘目录，实际 ${dir}`)
  })

  test('显式指定 toolResultsDir 时采用该目录', async () => {
    const custom = join(process.cwd(), '.kx2-test-results')
    await setup({ sessionId: 's-custom', toolResultsDir: custom })
    assert.ok(getToolResultsDir().includes('.kx2-test-results'), getToolResultsDir())
  })

  test('skipMacro 时不初始化宏也不抛错', async () => {
    await assert.doesNotReject(() => setup({ sessionId: 's-nomacro', skipMacro: true }))
  })

  test('不同 sessionId 各自初始化', async () => {
    await setup({ sessionId: 'a', toolResultsDir: join(process.cwd(), '.r-a') })
    await setup({ sessionId: 'b', toolResultsDir: join(process.cwd(), '.r-b') })
    assert.ok(getToolResultsDir().includes('.r-b'), '后一次显式配置应生效')
  })
})
