import { describe, it, expect, afterEach } from 'vitest'
import {
  getDedupOptions,
  setDedupOptions,
  DEFAULT_DEDUP_WINDOW_MS,
  DEFAULT_MAX_BUFFER_MB,
} from '../../main/proxy/dedup/index'
import {
  getMaxQueueBytes,
  setMaxQueueBytes,
  DEFAULT_MAX_QUEUE_BYTES,
} from '../../main/proxy/utils/streamQueueDetector'
import {
  getCheckTimeout,
  setCheckTimeout,
  DEFAULT_CHECK_TIMEOUT,
} from '../../main/providers/checker'
import {
  getSectionCacheLimit,
  setSectionCacheLimit,
  DEFAULT_MAX_CACHE_ENTRIES,
} from '../../engine/promptSections'

/** 这些参数原先都是模块常量，现可运行时调整。 */

describe('去重策略', () => {
  afterEach(() =>
    setDedupOptions({
      dedupWindowMs: DEFAULT_DEDUP_WINDOW_MS,
      maxBufferMb: DEFAULT_MAX_BUFFER_MB,
    }),
  )

  it('默认值与改造前一致', () => {
    expect(getDedupOptions()).toEqual({ dedupWindowMs: 2000, maxBufferMb: 10 })
  })

  it('可调整窗口与缓冲', () => {
    setDedupOptions({ dedupWindowMs: 5000, maxBufferMb: 20 })
    expect(getDedupOptions()).toEqual({ dedupWindowMs: 5000, maxBufferMb: 20 })
  })

  it('非法值被忽略', () => {
    setDedupOptions({ dedupWindowMs: 3000 })
    setDedupOptions({ dedupWindowMs: 0, maxBufferMb: -1 })
    expect(getDedupOptions().dedupWindowMs).toBe(3000)
    expect(getDedupOptions().maxBufferMb).toBe(DEFAULT_MAX_BUFFER_MB)
  })
})

describe('流队列检测缓冲', () => {
  afterEach(() => setMaxQueueBytes(DEFAULT_MAX_QUEUE_BYTES))

  it('默认 64KB', () => {
    expect(getMaxQueueBytes()).toBe(64 * 1024)
  })

  it('可调整，非法值忽略', () => {
    setMaxQueueBytes(128 * 1024)
    expect(getMaxQueueBytes()).toBe(128 * 1024)
    setMaxQueueBytes(0)
    expect(getMaxQueueBytes()).toBe(128 * 1024)
  })
})

describe('供应商探测超时', () => {
  afterEach(() => setCheckTimeout(DEFAULT_CHECK_TIMEOUT))

  it('默认 15 秒', () => {
    expect(getCheckTimeout()).toBe(15000)
  })

  it('可调整，非法值忽略', () => {
    setCheckTimeout(30000)
    expect(getCheckTimeout()).toBe(30000)
    setCheckTimeout(-1)
    expect(getCheckTimeout()).toBe(30000)
  })
})

describe('提示分片缓存上限', () => {
  afterEach(() => setSectionCacheLimit(DEFAULT_MAX_CACHE_ENTRIES))

  it('默认 200', () => {
    expect(getSectionCacheLimit()).toBe(200)
  })

  it('可调整，非法值忽略', () => {
    setSectionCacheLimit(500)
    expect(getSectionCacheLimit()).toBe(500)
    setSectionCacheLimit(0)
    expect(getSectionCacheLimit()).toBe(500)
  })
})
