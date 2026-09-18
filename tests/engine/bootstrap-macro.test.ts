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
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ensureBootstrapMacro } from '../../src/engine/bootstrap/macro.ts'

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
