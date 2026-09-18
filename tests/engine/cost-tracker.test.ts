/**
 * engine/cost 成本追踪模块测试
 *
 * 覆盖：pricing 计算、模型用量累加、总计聚合、状态恢复/快照往返、
 * 以及两处真实缺陷的回归：
 *   1. calculateCost 对未知模型返回 NaN —— 若直接累加会污染 totalCostUSD
 *   2. hasUnknownModelCost 原按 costUSD === 0 判定，NaN !== 0 会漏检
 *
 * 运行：node --import tsx --test tests/engine/cost-tracker.test.ts
 */
import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { calculateCost, MODEL_PRICING } from '../../src/engine/cost/pricing.ts'
import {
  addModelUsage,
  addAPIDuration,
  addToolDuration,
  getTotalCostUSD,
  getTotalInputTokens,
  getTotalOutputTokens,
  getTotalDuration,
  getUsageForModel,
  getModelUsage,
  getStoredState,
  restoreCostState,
  resetCostState,
  addToTotalLinesChanged,
  getTotalLinesAdded,
  getTotalLinesRemoved,
  hasUnknownModelCost,
  getCostCounter,
  setLastDuration,
  formatCost,
  formatTotalCost,
  resetStateForTests,
  setHasUnknownModelCost,
  recordApiUsage,
} from '../../src/engine/cost/costTracker.ts'

function usage(input: number, output: number) {
  return {
    inputTokens: input,
    outputTokens: output,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    webSearchRequests: 0,
  }
}

describe('pricing — calculateCost', () => {
  test('已知模型按 input/output 分别计价', () => {
    // gpt-4o: input 0.005/1K, output 0.015/1K
    const cost = calculateCost('gpt-4o', { inputTokens: 1000, outputTokens: 1000 })
    assert.ok(Math.abs(cost - (0.005 + 0.015)) < 1e-12, `实际 ${cost}`)
  })

  test('未提供缓存 token 时不计缓存成本', () => {
    const cost = calculateCost('gpt-4o', { inputTokens: 1000, outputTokens: 0 })
    assert.ok(Math.abs(cost - 0.005) < 1e-12)
  })

  test('缓存读写缺省回落到 input 单价', () => {
    const cost = calculateCost('gpt-4o', {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 1000,
      cacheCreationInputTokens: 1000,
    })
    // 两项各按 inputPer1K=0.005
    assert.ok(Math.abs(cost - 0.01) < 1e-12, `实际 ${cost}`)
  })

  test('未知模型返回 NaN（调用方必须处理，不能直接累加）', () => {
    const cost = calculateCost('完全不存在的模型', { inputTokens: 100, outputTokens: 100 })
    assert.ok(Number.isNaN(cost), '未知模型应返回 NaN 以提示价格表缺失')
  })

  test('价格表包含常用模型且单价为正数', () => {
    const names = Object.keys(MODEL_PRICING)
    assert.ok(names.length > 0)
    for (const n of names) {
      const p = MODEL_PRICING[n]
      assert.ok(p.inputPer1K > 0, `${n} input 单价应为正`)
      assert.ok(p.outputPer1K > 0, `${n} output 单价应为正`)
    }
  })
})

describe('costTracker — 累加与聚合', () => {
  beforeEach(() => resetCostState())

  test('addModelUsage 累加模型用量与全局总计', () => {
    addModelUsage('gpt-4o', usage(1000, 500), 0.0125)
    addModelUsage('gpt-4o', usage(1000, 500), 0.0125)
    assert.ok(Math.abs(getTotalCostUSD() - 0.025) < 1e-12)
    assert.equal(getTotalInputTokens(), 2000)
    assert.equal(getTotalOutputTokens(), 1000)
    assert.ok(Math.abs(getUsageForModel('gpt-4o')!.costUSD - 0.025) < 1e-12)
  })

  test('多模型分别统计，互不串味', () => {
    addModelUsage('gpt-4o', usage(1000, 0), 0.005)
    addModelUsage('claude-3-haiku-20240307', usage(1000, 0), 0.00025)
    assert.equal(getCostCounter(), 2)
    assert.ok(Math.abs(getTotalCostUSD() - 0.00525) < 1e-12)
    assert.ok(Math.abs(getUsageForModel('gpt-4o')!.costUSD - 0.005) < 1e-12)
  })

  test('NaN 成本不得污染 totalCostUSD（回归：未知模型价格缺失）', () => {
    addModelUsage('gpt-4o', usage(1000, 0), 0.005)
    const before = getTotalCostUSD()
    // 模拟调用方把 calculateCost 对未知模型返回的 NaN 直接传入
    addModelUsage('未知模型', usage(1000, 1000), Number.NaN)
    const after = getTotalCostUSD()
    assert.ok(Number.isFinite(after), `totalCostUSD 被 NaN 污染了：${after}`)
    assert.equal(after, before, '未知模型的 NaN 成本不应影响已有总计')
  })

  test('NaN 成本仍应计入 token 用量（token 是真实的）', () => {
    addModelUsage('未知模型', usage(1000, 500), Number.NaN)
    assert.equal(getTotalInputTokens(), 1000)
    assert.equal(getTotalOutputTokens(), 500)
  })

  test('时长累加与总计', () => {
    addAPIDuration(1000)
    addToolDuration(500)
    assert.equal(getTotalDuration(), 1500)
  })

  test('行数变更累加', () => {
    addToTotalLinesChanged(10, 3)
    addToTotalLinesChanged(5, 2)
    assert.equal(getTotalLinesAdded(), 15)
    assert.equal(getTotalLinesRemoved(), 5)
  })

  test('setLastDuration 接受 undefined', () => {
    setLastDuration(123)
    assert.equal(getStoredState().lastDuration, 123)
    setLastDuration(undefined)
    assert.equal(getStoredState().lastDuration, undefined)
  })
})

describe('hasUnknownModelCost — 未知成本检出', () => {
  beforeEach(() => resetCostState())

  test('零成本但有 token 的模型应被检出', () => {
    addModelUsage('免费模型', usage(1000, 100), 0)
    assert.equal(hasUnknownModelCost(), true)
  })

  test('NaN 成本（价格表缺失）也应被检出（回归）', () => {
    addModelUsage('未知模型', usage(1000, 100), Number.NaN)
    assert.equal(hasUnknownModelCost(), true, 'NaN 成本属于"未知成本"，必须被检出')
  })

  test('全部有正常成本时不应误报', () => {
    addModelUsage('gpt-4o', usage(1000, 100), 0.0065)
    assert.equal(hasUnknownModelCost(), false)
  })

  test('无任何用量时不应误报', () => {
    assert.equal(hasUnknownModelCost(), false)
  })
})

describe('状态快照与恢复', () => {
  beforeEach(() => resetCostState())

  test('getStoredState → restoreCostState 往返一致', () => {
    addModelUsage('gpt-4o', usage(1000, 500), 0.0125)
    addToTotalLinesChanged(7, 2)
    addAPIDuration(300)
    const snap = getStoredState()

    resetCostState()
    assert.equal(getTotalCostUSD(), 0)

    restoreCostState(snap)
    assert.ok(Math.abs(getTotalCostUSD() - 0.0125) < 1e-12)
    assert.equal(getTotalInputTokens(), 1000)
    assert.equal(getTotalLinesAdded(), 7)
    assert.ok(Math.abs(getUsageForModel('gpt-4o')!.costUSD - 0.0125) < 1e-12)
  })

  test('快照不包含 contextWindow/maxOutputTokens（体积优化）', () => {
    addModelUsage('gpt-4o', usage(10, 10), 0.001)
    const snap = getStoredState()
    const u = snap.modelUsage!['gpt-4o'] as Record<string, unknown>
    assert.equal('contextWindow' in u, false)
    assert.equal('maxOutputTokens' in u, false)
  })

  test('restoreCostState(undefined) 是安全的无操作', () => {
    addModelUsage('gpt-4o', usage(100, 100), 0.001)
    const before = getTotalCostUSD()
    restoreCostState(undefined)
    assert.equal(getTotalCostUSD(), before)
  })

  test('resetCostState 保留 lastSessionId（跨会话标识）', () => {
    restoreCostState({ lastSessionId: 'sess-1' } as never)
    resetCostState()
    assert.equal(getStoredState().lastSessionId, 'sess-1')
  })
})

describe('formatCost — 费用格式化', () => {
  test('零费用显示 $0.00', () => {
    assert.equal(formatCost(0), '$0.00')
  })

  test('小额保留 4 位（避免全部显示为 $0.00）', () => {
    assert.equal(formatCost(0.0001), '$0.0001')
    assert.equal(formatCost(0.005), '$0.0050')
  })

  test('中等额保留 3 位', () => {
    assert.equal(formatCost(0.123), '$0.123')
  })

  test('大于 1 保留 2 位', () => {
    assert.equal(formatCost(1.2345), '$1.23')
    assert.equal(formatCost(12.5), '$12.50')
  })

  test('非有限值显示 $?（提示价格表缺失，而非误导为 0）', () => {
    assert.equal(formatCost(Number.NaN), '$?')
    assert.equal(formatCost(Infinity), '$?')
  })

  test('负数（可能的退款/校正）也可格式化', () => {
    assert.equal(formatCost(-0.5), '$-0.500')
  })
})

describe('formatTotalCost — 总计格式化', () => {
  beforeEach(() => resetStateForTests())

  test('无调用记录时给出提示', () => {
    const s = formatTotalCost()
    assert.ok(s.includes('总费用：$0.00'), s)
    assert.ok(s.includes('暂无调用记录'), s)
  })

  test('包含各模型明细与 token 计数', () => {
    addModelUsage('gpt-4o', usage(1200, 800), 0.018)
    const s = formatTotalCost()
    assert.ok(s.includes('gpt-4o'), s)
    assert.ok(s.includes('1,200 in'), s)
    assert.ok(s.includes('800 out'), s)
  })

  test('存在未知成本时给出告警行', () => {
    addModelUsage('未知模型', usage(100, 100), 0)
    const s = formatTotalCost()
    assert.ok(s.includes('未知模型成本'), s)
  })

  test('按费用降序排列明细', () => {
    addModelUsage('cheap', usage(100, 100), 0.001)
    addModelUsage('expensive', usage(100, 100), 9)
    const s = formatTotalCost()
    assert.ok(s.indexOf('expensive') < s.indexOf('cheap'), '费用高的应排在前面')
  })
})

describe('setHasUnknownModelCost — 显式标志', () => {
  beforeEach(() => resetStateForTests())

  test('设置后 hasUnknownModelCost 为真（即使无任何用量）', () => {
    assert.equal(hasUnknownModelCost(), false)
    setHasUnknownModelCost(true)
    assert.equal(hasUnknownModelCost(), true)
  })

  test('resetStateForTests 清掉显式标志', () => {
    setHasUnknownModelCost(true)
    resetStateForTests()
    assert.equal(hasUnknownModelCost(), false)
  })

  test('resetCostState 不清显式标志（保留会话级判断）', () => {
    setHasUnknownModelCost(true)
    resetCostState()
    assert.equal(hasUnknownModelCost(), true)
    setHasUnknownModelCost(false)
  })
})

describe('recordApiUsage — 引擎接线入口', () => {
  beforeEach(() => resetStateForTests())

  test('已知模型：按价格表换算并累加', () => {
    recordApiUsage('gpt-4o', 1000, 1000)
    assert.ok(Math.abs(getTotalCostUSD() - (0.005 + 0.015)) < 1e-12, `实际 ${getTotalCostUSD()}`)
    assert.equal(getTotalInputTokens(), 1000)
    assert.equal(getTotalOutputTokens(), 1000)
    assert.equal(getUsageForModel('gpt-4o')!.costUSD > 0, true)
  })

  test('多次调用累加', () => {
    recordApiUsage('gpt-4o', 1000, 0)
    recordApiUsage('gpt-4o', 1000, 0)
    assert.ok(Math.abs(getTotalCostUSD() - 0.01) < 1e-12)
    assert.equal(getTotalInputTokens(), 2000)
  })

  test('未知模型：token 统计、费用不污染总计、并标记未知成本', () => {
    recordApiUsage('gpt-4o', 1000, 0)
    const before = getTotalCostUSD()
    recordApiUsage('某不存在的模型', 500, 500)

    assert.ok(Number.isFinite(getTotalCostUSD()), '总计不得被 NaN 污染')
    assert.equal(getTotalCostUSD(), before, '未知模型不应影响已知的累计费用')
    assert.equal(getTotalInputTokens(), 1500, 'token 仍应累计')
    assert.equal(hasUnknownModelCost(), true, '应标记存在未知成本')
  })

  test('负数/非法 token 被规整为 0，不产生负费用', () => {
    recordApiUsage('gpt-4o', -100, -50)
    assert.equal(getTotalInputTokens(), 0)
    assert.equal(getTotalOutputTokens(), 0)
    assert.equal(getTotalCostUSD(), 0)
  })

  test('小数 token 向下取整为整数', () => {
    recordApiUsage('gpt-4o', 100.9, 50.2)
    assert.equal(getTotalInputTokens(), 100)
    assert.equal(getTotalOutputTokens(), 50)
  })
})

describe('resetStateForTests — 测试隔离', () => {
  test('清空所有计数与 lastSessionId', () => {
    addModelUsage('gpt-4o', usage(100, 100), 0.01)
    restoreCostState({ lastSessionId: 'sess-x' } as never)
    resetStateForTests()
    assert.equal(getTotalCostUSD(), 0)
    assert.equal(getCostCounter(), 0)
    assert.equal(getStoredState().lastSessionId, void 0)
  })
})
