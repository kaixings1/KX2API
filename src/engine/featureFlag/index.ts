/**
 * engine/featureFlag/index.ts — 特性标记系统 barrel export
 */
export {
  GrowthBook,
  createGrowthBook,
  murmurHash3,
} from './growthBook.ts'

export type {
  Feature,
  FeatureRule,
  FeatureResult,
  GrowthBookOptions,
} from './types.ts'

export {
  getHashAttribute,
  getStickyBucketAttributeKey,
  isIncluded,
} from './hash.ts'

export type {
  Experiment,
  ExperimentResult,
  ExperimentStatus,
} from './experiments.ts'

export {
  runExperiment,
  getExperimentResult,
  saveExperimentResult,
  getAllExperimentResults,
  getExperimentDedupeKey,
} from './experiments.ts'

export type {
  StickyBucketService,
  MemoryStickyBucketService,
  CookieAttributes,
  JsCookiesCompat,
  IORedisCompat,
} from './stickyBucket.ts'

export {
  prefetchPayload,
  clearPrefetchCache,
} from './prefetch.ts'

export type {
  FeatureApiResponse,
} from './prefetch.ts'

export type {
  FeatureRepositoryHelpers,
} from './repositoryHelpers.ts'

export {
  createFeatureRepositoryHelpers,
} from './repositoryHelpers.ts'
