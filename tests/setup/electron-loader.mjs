/**
 * tests/setup/electron-loader.mjs — 测试环境的统一引导
 *
 * 用法：node --import tsx --import ./tests/setup/electron-loader.mjs --test <file>
 *
 * 做两件事：
 * 1. 注册解析钩子，把 `electron` / `electron-store` 指向 tests/setup 下的替身
 *    （替身文件只是导出假对象，不会自动生效，必须有这个钩子）
 * 2. 顺手初始化 storeManager —— 不少测试会读配置（PromptInjectionService、
 *    ToolCallingEngine 等），不初始化就会抛 “Storage not initialized”。
 *    存储路径 ~/.chat2api 由 runner 通过 USERPROFILE/HOME 指到临时目录，
 *    不会污染真实数据。
 */

import { register } from 'node:module'

register(new URL('./electron-resolve-hook.mjs', import.meta.url))

try {
  const { storeManager } = await import('../../src/main/store/store.ts')
  await storeManager.initialize()
} catch (e) {
  // 初始化失败不要挡住纯逻辑测试（它们不读配置）
  console.warn('[electron-loader] store 初始化失败（不影响不依赖配置的测试）:', e?.message || e)
}
