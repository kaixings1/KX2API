/**
 * engine/featureFlag/prefetch.ts — GrowthBook 预取 payload
 *
 * 实现 prefetchPayload() 和本地缓存策略。
 */

import type { Feature } from './types.js'

/** 远程 API 响应 */
export interface FeatureApiResponse {
  features: Record<string, Feature>
  encryptedFeatures?: string
}

/** 缓存条目 */
interface CacheEntry {
  data: FeatureApiResponse
  expiresAt: number
}

const payloadCache = new Map<string, CacheEntry>()

/** 预取 payload */
export async function prefetchPayload(options: {
  apiHost: string
  clientKey: string
  ttl?: number
}): Promise<FeatureApiResponse | null> {
  const { apiHost, clientKey, ttl = 300000 } = options
  const cacheKey = `${apiHost}/${clientKey}`

  // 检查缓存
  const cached = payloadCache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data
  }

  try {
    // TODO: 实际 HTTP 请求（需要 HTTP client 依赖）
    // const response = await fetch(`${apiHost}/api/features/${clientKey}`)
    // const data = await response.json()

    // 临时返回空
    const data: FeatureApiResponse = { features: {} }
    payloadCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + ttl,
    })
    return data
  } catch {
    return cached?.data ?? null
  }
}

/** 清除 payload 缓存 */
export function clearPrefetchCache(): void {
  payloadCache.clear()
}
