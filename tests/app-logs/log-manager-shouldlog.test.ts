/**
 * 日志分类过滤的接线契约测试
 *
 * 背景：`src/main/logger/categoryFilter.ts` 里的 `shouldLog` 等纯函数
 * **只被测试调用**，`LogManager.log()` 自己内联了一份等价判定 ——
 * 即"提取出来的正确实现没接回去"。两份判定逻辑并存时，改一处忘另一处
 * 就会出现「测试测的是 A 套、生产跑的是 B 套」的漂移，且不报错、只表现为
 * 某个分类的日志莫名多了或少了。
 *
 * 现已接线：`LogManager.log()` 在分类配置**存在**时改调 `shouldLog`。
 *
 * ⚠️ 刻意保留的行为差异（本测试即锁定它，勿误改）：
 *   `shouldLog` 在配置**缺失**时返回 disabled（拦），
 *   而 LogManager 历来是「分类不在配置表内 → 放行」（未登记的分类不该被静默丢掉）。
 *   接线只在 config 存在时才交给 shouldLog，因此该差异是**有意**的。
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { LogManager } from '../../src/main/logger/manager.ts'
import {
  shouldLog,
  DEFAULT_LOG_CATEGORIES,
  type LogLevel,
} from '../../src/main/logger/categoryFilter.ts'

/** 用临时目录构造一个不落盘真实用户数据的 manager */
function makeManager() {
  const m = new LogManager({ maxLogs: 100 } as never)
  return m
}

describe('日志分类过滤接线', () => {
  test('默认配置下常规 info 日志会被记录', () => {
    const m = makeManager()
    const entry = m.log('info', 'hello', { category: 'app' } as never)
    assert.ok(entry, '默认配置下 app/info 应被记录')
    assert.equal(entry!.category, 'app')
  })

  test('分类被禁用时丢弃（与 shouldLog 判定一致）', () => {
    const m = makeManager()
    m.setCategoryConfigs({ app: { level: 'info', enabled: false } })
    assert.equal(shouldLog('app', 'info', m.getCategoryConfigs()).passed, null)
    assert.equal(m.log('info', 'x', { category: 'app' } as never), null, 'manager 应同样丢弃')
  })

  test('级别低于阈值时丢弃（与 shouldLog 判定一致）', () => {
    const m = makeManager()
    // ui 默认 warn：debug/info 应被丢
    assert.equal(DEFAULT_LOG_CATEGORIES.ui.level, 'warn')
    assert.equal(m.log('debug', 'x', { category: 'ui' } as never), null)
    assert.equal(m.log('info', 'x', { category: 'ui' } as never), null)
    assert.ok(m.log('warn', 'x', { category: 'ui' } as never), 'warn 应通过')
  })

  test('未登记的分类仍然放行（刻意保留的语义，勿改）', () => {
    const m = makeManager()
    const entry = m.log('info', 'x', { category: 'some-unregistered-category' } as never)
    assert.ok(entry, '未登记分类应放行 —— 缺失配置不该静默丢日志')
    // 对照：shouldLog 对缺失配置是"拦"的，这正是两者刻意保留的差异
    assert.equal(shouldLog('some-unregistered-category', 'info', {}).passed, null)
  })

  test('全部级别阈值与 shouldLog 完全一致（防两份逻辑漂移）', () => {
    const m = makeManager()
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    for (const [cat, cfg] of Object.entries(DEFAULT_LOG_CATEGORIES)) {
      for (const lv of levels) {
        const byFn = shouldLog(cat, lv, DEFAULT_LOG_CATEGORIES).passed !== null
        const actual = m.log(lv, 'x', { category: cat } as never) !== null
        assert.equal(actual, byFn, `分类 ${cat} / 级别 ${lv}：manager 与 shouldLog 判定必须一致（cfg=${cfg.level},enabled=${cfg.enabled}）`)
      }
    }
  })
})
