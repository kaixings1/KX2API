/**
 * Credential Storage Module - Entry File
 * Export all storage related types and APIs
 */

// Type definitions
export * from './types'

// Core storage
// 必须先 import 建立本地绑定 —— 下面的 initializeStore() 要用到 storeManager，
// 而 `export { X } from '...'` 只对外暴露名字，不在本模块作用域建立绑定
// （直接引用会抛 ReferenceError）。
import { storeManager } from './store'
export { storeManager, StoreManager } from './store'

// Account management API
export { AccountManager } from './accounts'

// Provider management API
export { ProviderManager } from './providers'

// Config management API
export { ConfigManager } from './config'

// Credential validation
export {
  validateCredentials,
  validateCredentialsBatch,
  validateOpenAIKey,
  validateClaudeKey,
  validateChatGPTCookie,
} from './validator'

// Convenience function to initialize storage
export async function initializeStore(): Promise<void> {
  await storeManager.initialize()
}
