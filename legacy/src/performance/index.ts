/**
 * performance/ — KX2API barrel 导出
 */

export { LRUCache, type LRUCacheOptions } from './LRUCache.js'
export { Debounce } from './Debounce.js'
export { Memoize } from './Memoize.js'
export { retry, type RetryOptions, DEFAULT_RETRY_OPTIONS } from './Retryer.js'
export { ObjectPool } from './ObjectPool.js'
export {
  MemoryMonitor,
  type MemoryStats,
  type MemoryThreshold,
} from './MemoryMonitor.js'
export {
  PerformanceMonitor,
  type PerformanceMetric,
} from './PerformanceMonitor.js'
export { RequestQueue, type QueuedRequest } from './RequestQueue.js'
export { LazyLoader, type LazyModule } from './LazyLoader.js'
export { StartupOptimizer, type StartupPhase } from './StartupOptimizer.js'
export {
  VirtualScroller,
  type VirtualScrollItem,
  type VirtualScrollConfig,
} from './VirtualScroller.js'
export {
  ContextCompactor,
  type CompactConfig,
  type Message as CompactMessage,
} from './ContextCompactor.js'
