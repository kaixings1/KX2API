/**
 * store/apiKeySync.ts — Profile apiKey 同步到代理认证列表的共享工具
 *
 * 消除 engine-bridge.ts 和 chat-handlers.ts 中的重复同步逻辑
 */

import { storeManager } from './store'
import type { Profile } from '../profiles/manager'

export function syncProfileApiKey(profile: Profile): void {
  if (!profile.apiKey) return

  const currentConfig = storeManager.getConfig()
  if (!currentConfig.enableApiKey) return

  const existingKeys = currentConfig.apiKeys || []
  const alreadyExists = existingKeys.some((k: any) => k.key === profile.apiKey)
  if (alreadyExists) return

  const newKey = {
    id: 'prof_' + Date.now().toString(36),
    name: profile.name + ' (auto)',
    key: profile.apiKey,
    enabled: true,
    createdAt: Date.now(),
    usageCount: 0,
  }
  storeManager.updateConfig({ apiKeys: [...existingKeys, newKey] })
}
