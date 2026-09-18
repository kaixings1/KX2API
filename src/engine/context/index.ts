/**
 * engine/context/index.ts — 上下文系统 barrel export
 */
export { getSystemPromptInjection, setSystemPromptInjection } from './promptInjection.js'
export type { SystemContextData } from './systemContext.js'
export { getSystemContext } from './systemContext.js'
export {
  isBareMode,
  getAdditionalDirectoriesForClaudeMd,
  isEnvTruthy,
  filterInjectedMemoryFiles,
  setCachedClaudeMdContent,
  getCachedClaudeMdContent,
  getCachedClaudeMdPath,
} from './claudeMd.js'
export type { UserContextData } from './userContext.js'
export { getUserContext, clearUserContextCache } from './userContext.js'
