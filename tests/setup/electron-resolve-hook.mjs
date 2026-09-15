/**
 * tests/setup/electron-resolve-hook.mjs — 把 `electron` 指向测试替身
 *
 * 背景：tests/setup/electron-mock.ts 只是导出了一堆假对象，并没有拦截解析。
 * 所以 `import { app } from 'electron'` 在纯 Node 下拿到的仍是真 electron 包
 * （CJS，导出一个路径字符串），于是报 “does not provide an export named 'app'”。
 * 这个 resolve 钩子把 specifier 改写到替身文件，配合 tsx 就能正常 import。
 */

const MOCK_URL = new URL('./electron-mock.ts', import.meta.url).href
const STORE_MOCK_URL = new URL('./electron-store-mock.ts', import.meta.url).href

/** 需要被替换的第三方模块 → 替身 */
const REPLACEMENTS = new Map([
  ['electron', MOCK_URL],
  ['electron-store', STORE_MOCK_URL],
])

export async function resolve(specifier, context, nextResolve) {
  const hit = REPLACEMENTS.get(specifier)
  if (hit) {
    return { url: hit, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
