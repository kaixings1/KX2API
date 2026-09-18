/**
 * engine/bootstrap/macro.ts — Bootstrap 宏
 *
 * 实现 ensureBootstrapMacro()，确保 MACRO 全局对象可用。
 */

import { readFileSync } from 'node:fs'

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

/**
 * 获取宏配置。
 *
 * 版本号优先取运行时注入的包版本（Electron 主进程启动时写入的
 * KX2_APP_VERSION），再回落读 package.json。
 *
 * ⚠️ 原实现用 `require('../../package.json')`：
 *   ① 路径错一层（本文件在 src/engine/bootstrap/，`../../` 指向 src/，
 *      项目 package.json 在仓库根，应为 `../../../`）；
 *   ② 本包是 ESM（package.json 里 `"type": "module"`），`require` 不存在。
 *   两者叠加 + try/catch 静默 → VERSION 恒为 '0.0.0'，问题被完全掩盖。
 * 这里改用「环境变量优先 + 静态 import 兜底」，避免再依赖 CJS 语义。
 */
function getMacroConfig(): MacroConfig {
  let version = process.env.KX2_APP_VERSION || '0.0.0'
  if (!process.env.KX2_APP_VERSION) {
    try {
      // 相对本文件：src/engine/bootstrap/ → ../../../ 即仓库根
      const pkg = JSON.parse(
        readFileSync(new URL('../../../package.json', import.meta.url), 'utf-8'),
      ) as { version?: string }
      if (pkg.version) version = pkg.version
    } catch {
      // 读不到就保持默认版本，不影响启动
    }
  }

  return {
    VERSION: version,
    BUILD_TIME: process.env.BUILD_TIME,
    PACKAGE_URL: process.env.PACKAGE_URL,
  }
}
