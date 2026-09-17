import { describe, it, expect, afterEach } from 'vitest'
import {
  getMemoryRecallLimits,
  setMemoryRecallLimits,
  DEFAULT_MAX_MEMORIES_PER_TURN,
  DEFAULT_MAX_LINES_PER_MEMORY,
  DEFAULT_MAX_BYTES_PER_MEMORY,
  DEFAULT_MAX_SCAN_FILES,
  DEFAULT_MIN_RELEVANCE_SCORE,
} from '../../engine/memory/memoryRecall'

/**
 * 记忆召回限制此前是模块常量，现可运行时调整。
 * 这些值决定「每轮注入哪些记忆、多少内容」，直接影响上下文占用。
 */
describe('记忆召回限制', () => {
  const reset = () =>
    setMemoryRecallLimits({
      maxMemoriesPerTurn: DEFAULT_MAX_MEMORIES_PER_TURN,
      maxLinesPerMemory: DEFAULT_MAX_LINES_PER_MEMORY,
      maxBytesPerMemory: DEFAULT_MAX_BYTES_PER_MEMORY,
      maxScanFiles: DEFAULT_MAX_SCAN_FILES,
      minRelevanceScore: DEFAULT_MIN_RELEVANCE_SCORE,
    })

  afterEach(reset)

  it('默认值与改造前保持一致', () => {
    const o = getMemoryRecallLimits()
    expect(o.maxMemoriesPerTurn).toBe(5)
    expect(o.maxLinesPerMemory).toBe(200)
    expect(o.maxBytesPerMemory).toBe(4096)
    expect(o.maxScanFiles).toBe(200)
    expect(o.minRelevanceScore).toBe(1)
  })

  it('可逐项覆盖', () => {
    setMemoryRecallLimits({ maxMemoriesPerTurn: 10 })
    expect(getMemoryRecallLimits().maxMemoriesPerTurn).toBe(10)
    expect(getMemoryRecallLimits().maxLinesPerMemory).toBe(DEFAULT_MAX_LINES_PER_MEMORY)
  })

  it('全部字段可覆盖', () => {
    setMemoryRecallLimits({
      maxMemoriesPerTurn: 1,
      maxLinesPerMemory: 50,
      maxBytesPerMemory: 1024,
      maxScanFiles: 20,
      minRelevanceScore: 3,
    })
    expect(getMemoryRecallLimits()).toEqual({
      maxMemoriesPerTurn: 1,
      maxLinesPerMemory: 50,
      maxBytesPerMemory: 1024,
      frontmatterScanLines: 30,
      maxScanFiles: 20,
      minRelevanceScore: 3,
    })
  })

  it('非法值被忽略，保留原值', () => {
    setMemoryRecallLimits({ maxMemoriesPerTurn: 8 })
    setMemoryRecallLimits({
      maxMemoriesPerTurn: 0,
      maxLinesPerMemory: -1,
      minRelevanceScore: NaN,
    })
    const o = getMemoryRecallLimits()
    expect(o.maxMemoriesPerTurn).toBe(8)
    expect(o.maxLinesPerMemory).toBe(DEFAULT_MAX_LINES_PER_MEMORY)
    expect(o.minRelevanceScore).toBe(DEFAULT_MIN_RELEVANCE_SCORE)
  })

  it('Infinity 被忽略，避免无上限扫描', () => {
    setMemoryRecallLimits({ maxScanFiles: Infinity })
    expect(getMemoryRecallLimits().maxScanFiles).toBe(DEFAULT_MAX_SCAN_FILES)
  })

  it('返回副本，外部修改不影响内部状态', () => {
    const o = getMemoryRecallLimits()
    o.maxMemoriesPerTurn = 999
    expect(getMemoryRecallLimits().maxMemoriesPerTurn).toBe(
      DEFAULT_MAX_MEMORIES_PER_TURN,
    )
  })
})
