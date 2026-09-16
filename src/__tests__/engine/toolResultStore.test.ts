import { describe, it, expect, afterEach } from 'vitest'
import {
  DEFAULT_MAX_RESULT_SIZE_CHARS,
  DEFAULT_PREVIEW_SIZE_BYTES,
  DEFAULT_MAX_RESULTS_PER_MESSAGE_CHARS,
  getToolResultStoreOptions,
  setToolResultStoreOptions,
} from '../../engine/toolResultStore'

/**
 * 落盘策略此前是硬编码常量，现支持运行时更新。
 * 这些用例锁定「默认值不变 + 非法值忽略 + 热更新生效」三项契约。
 */
describe('toolResultStore 落盘策略', () => {
  // 每个用例后恢复默认，避免用例间互相污染（配置是模块级状态）
  afterEach(() => {
    setToolResultStoreOptions({
      maxResultSizeChars: DEFAULT_MAX_RESULT_SIZE_CHARS,
      previewSizeBytes: DEFAULT_PREVIEW_SIZE_BYTES,
      maxResultsPerMessageChars: DEFAULT_MAX_RESULTS_PER_MESSAGE_CHARS,
    })
  })

  it('默认值与改造前保持一致', () => {
    const o = getToolResultStoreOptions()
    expect(o.maxResultSizeChars).toBe(50_000)
    expect(o.previewSizeBytes).toBe(2000)
    expect(o.maxResultsPerMessageChars).toBe(200_000)
  })

  it('可更新落盘阈值', () => {
    setToolResultStoreOptions({ maxResultSizeChars: 1000 })
    expect(getToolResultStoreOptions().maxResultSizeChars).toBe(1000)
  })

  it('可更新预览大小', () => {
    setToolResultStoreOptions({ previewSizeBytes: 500 })
    expect(getToolResultStoreOptions().previewSizeBytes).toBe(500)
  })

  it('可更新单轮聚合上限', () => {
    setToolResultStoreOptions({ maxResultsPerMessageChars: 300000 })
    expect(getToolResultStoreOptions().maxResultsPerMessageChars).toBe(300000)
  })

  it('非法值被忽略，保留原设置', () => {
    setToolResultStoreOptions({ maxResultSizeChars: 2000 })
    setToolResultStoreOptions({
      maxResultSizeChars: 0,
      previewSizeBytes: -1,
      maxResultsPerMessageChars: NaN,
    })
    const o = getToolResultStoreOptions()
    expect(o.maxResultSizeChars).toBe(2000)
    expect(o.previewSizeBytes).toBe(DEFAULT_PREVIEW_SIZE_BYTES)
    expect(o.maxResultsPerMessageChars).toBe(DEFAULT_MAX_RESULTS_PER_MESSAGE_CHARS)
  })

  it('部分字段更新不影响其他字段', () => {
    setToolResultStoreOptions({ previewSizeBytes: 800 })
    const o = getToolResultStoreOptions()
    expect(o.previewSizeBytes).toBe(800)
    expect(o.maxResultSizeChars).toBe(DEFAULT_MAX_RESULT_SIZE_CHARS)
  })

  it('小数被向下取整', () => {
    setToolResultStoreOptions({ maxResultSizeChars: 1500.9 })
    expect(getToolResultStoreOptions().maxResultSizeChars).toBe(1500)
  })

  it('返回值是副本，外部修改不影响内部状态', () => {
    const o = getToolResultStoreOptions()
    o.maxResultSizeChars = 1
    expect(getToolResultStoreOptions().maxResultSizeChars).toBe(
      DEFAULT_MAX_RESULT_SIZE_CHARS,
    )
  })
})
