/**
 * engine/featureFlag/index.ts — 特性标记系统 barrel export
 */
export {
  GrowthBook,
  createGrowthBook,
  murmurHash3,
} from './growthBook.js'

export type {
  Feature,
  FeatureRule,
  FeatureResult,
  GrowthBookOptions,
} from './types.js'

export {
  getHashAttribute,
  getStickyBucketAttributeKey,
  isIncluded,
} from './hash.js'

export type {
  Experiment,
  ExperimentResult,
  ExperimentStatus,
} from './experiments.js'

export {
  runExperiment,
  getExperimentResult,
  saveExperimentResult,
  getAllExperimentResults,
  getExperimentDedupeKey,
} from './experiments.js'

export type {
  StickyBucketService,
  MemoryStickyBucketService,
  CookieAttributes,
  JsCookiesCompat,
  IORedisCompat,
} from './stickyBucket.js'

export {
  prefetchPayload,
  clearPrefetchCache,
} from './prefetch.js'

export type {
  FeatureApiResponse,
} from './prefetch.js'

export type {
  FeatureRepositoryHelpers,
} from './repositoryHelpers.js'

export {
  createFeatureRepositoryHelpers,
} from './repositoryHelpers.js'
