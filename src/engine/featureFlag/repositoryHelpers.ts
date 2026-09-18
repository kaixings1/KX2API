/**
 * engine/featureFlag/repositoryHelpers.ts — 特性仓库 Helpers
 *
 * 实现 helpers 对象：getVisibleFeatures, getEvaluatedFeatures, refreshFeatures。
 */

import { createGrowthBook, type GrowthBook } from './growthBook.ts'
import type { FeatureResult } from './types.ts'
import type { Feature } from './types.ts'

/** 仓库 helpers 接口 */
export interface FeatureRepositoryHelpers {
  getVisibleFeatures(features: Record<string, Feature>): Record<string, Feature>
  getEvaluatedFeatures(gb: GrowthBook): Map<string, FeatureResult>
  refreshFeatures(gb: GrowthBook): Map<string, FeatureResult>
}

/** 创建 helpers 对象 */
export function createFeatureRepositoryHelpers(
  getVisibleFeaturesFilter?: (features: Record<string, Feature>) => Record<string, Feature>,
): FeatureRepositoryHelpers {
  return {
    /** 获取可见特性（过滤不可见的） */
    getVisibleFeatures(features: Record<string, Feature>): Record<string, Feature> {
      if (getVisibleFeaturesFilter) {
        return getVisibleFeaturesFilter(features)
      }
      return features
    },

    /** 获取已求值的特性 */
    getEvaluatedFeatures(gb: GrowthBook): Map<string, FeatureResult> {
      return gb.getFeatures()
    },

    /** 刷新特性（重新求值） */
    refreshFeatures(gb: GrowthBook): Map<string, FeatureResult> {
      // GrowthBook 是纯函数求值，无需额外刷新
      return gb.getFeatures()
    },
  }
}
