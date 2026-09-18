/**
 * engine/featureFlag/experiments.ts — 实验系统
 *
 * 实现 runExperiment() 和 getExperimentResult()。
 */

import { murmurHash3 } from './growthBook.ts'
import { chooseVariation, isIncluded } from './hash.ts'

/** 实验状态 */
export type ExperimentStatus = 'draft' | 'running' | 'stopped' | 'archived'

/** 实验定义 */
export interface Experiment {
  name: string
  variations: unknown[]
  coverage?: number
  status: ExperimentStatus
  hashAttribute?: string
}

/** 实验结果 */
export interface ExperimentResult {
  name: string
  variation: unknown
  value: unknown
  source: 'experiment' | 'default'
  meta?: Record<string, unknown>
}

/** 实验存储 */
const experimentStore = new Map<string, ExperimentResult>()

/** 运行实验 */
export function runExperiment(
  name: string,
  options: {
    variations: unknown[]
    coverage?: number
    hashAttribute?: string
    attributes?: Record<string, string | number>
  },
): ExperimentResult {
  const { variations, coverage = 1, hashAttribute = 'id' } = options
  const hashValue = String(options.attributes?.[hashAttribute] || hashAttribute)

  const idx = chooseVariation(variations.length, coverage, hashValue)
  const variation = idx >= 0 ? variations[idx] : variations[0]

  const result: ExperimentResult = {
    name,
    variation,
    value: variation,
    source: idx >= 0 ? 'experiment' : 'default',
    meta: { hashAttribute, coverage },
  }

  experimentStore.set(name, result)
  return result
}

/** 获取实验结果 */
export function getExperimentResult(experimentName: string): ExperimentResult | null {
  return experimentStore.get(experimentName) ?? null
}

/** 保存实验结果 */
export function saveExperimentResult(result: ExperimentResult): void {
  experimentStore.set(result.name, result)
}

/** 获取所有实验结果 */
export function getAllExperimentResults(): ExperimentResult[] {
  return Array.from(experimentStore.values())
}

/** 生成去重键 */
export function getExperimentDedupeKey(name: string, attributes: Record<string, string | number>): string {
  const parts = [name]
  for (const [k, v] of Object.entries(attributes)) {
    parts.push(`${k}=${v}`)
  }
  return parts.join('&')
}
