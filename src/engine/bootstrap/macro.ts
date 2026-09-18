/**
 * engine/bootstrap/macro.ts — Bootstrap 宏
 *
 * 实现 ensureBootstrapMacro()，确保 MACRO 全局对象可用。
 */

/** MACRO 配置接口 */
export interface MacroConfig {
  VERSION: string
  BUILD_TIME?: string
  PACKAGE_URL?: string
}

let macroInitialized = false

/** 确保 MACRO 全局对象可用 */
export function ensureBootstrapMacro(): void {
  if (macroInitialized) return

  if (typeof globalThis !== 'undefined' && !(globalThis as Record<string, unknown>).MACRO) {
    const config = getMacroConfig()
    ;(globalThis as Record<string, unknown>).MACRO = config
  }

  macroInitialized = true
}

/** 获取宏配置 */
function getMacroConfig(): MacroConfig {
  // 从 package.json 读取版本
  let version = '0.0.0'
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('../../package.json') as { version?: string }
    if (pkg.version) version = pkg.version
  } catch {
    // ignore
  }

  return {
    VERSION: version,
    BUILD_TIME: process.env.BUILD_TIME,
    PACKAGE_URL: process.env.PACKAGE_URL,
  }
}
