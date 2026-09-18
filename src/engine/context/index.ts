/**
 * engine/context/index.ts — 上下文系统 barrel export
 */
export { getSystemPromptInjection, setSystemPromptInjection } from './promptInjection.ts'
export type { SystemContextData } from './systemContext.ts'
export { getSystemContext } from './systemContext.ts'
export {
  isBareMode,
  getAdditionalDirectoriesForClaudeMd,
  isEnvTruthy,
  filterInjectedMemoryFiles,
  setCachedClaudeMdContent,
  getCachedClaudeMdContent,
  getCachedClaudeMdPath,
} from './claudeMd.ts'
export type { UserContextData } from './userContext.ts'
export { getUserContext, clearUserContextCache } from './userContext.ts'
