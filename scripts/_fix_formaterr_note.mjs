import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/shared/formatError.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 这里用 `require('@/i18n')` 尝试加载渲染层模块：
//   - `@` 是 renderer 专属别名，主进程产物里解析不了；
//   - ESM 产物里裸 require 也不存在。
// 但经核实：main 进程只调用 formatSystemError / formatSystemHttpError，
// 二者不经过本函数；translateI18nKey 仅服务于渲染层的
// formatUserError / formatHttpError。也就是说这条路径在 main 里**永远不会执行**，
// 当前不构成运行时故障 —— 它是「渲染层逻辑落在 shared/」的结构问题。
//
// 因此这里不引入 async import（会让调用方被迫变异步），
// 只把边界与结论写清楚，避免后人误以为它是活的 main 路径。
const oldHead = 'function translateI18nKey(i18nKey: string, fallback: string, params?: Record<string, string>): string {'
if (!s.includes(oldHead)) {
  console.log('未命中 translateI18nKey')
  process.exit(1)
}

s = s.replace(
  oldHead,
  [
    '/**',
    ' * 渲染层专用：翻译 i18n key。',
    ' *',
    ' * ⚠️ 边界说明：',
    ' * - 内部用 `require("@/i18n")` / `require("@/stores/settingsStore")` 取渲染层单例。',
    ' *   `@` 是 renderer 别名、且 ESM 产物里没有 require —— 在**主进程**中必然抛错，',
    ' *   故两条路径都被 try/catch 包住并回退到 fallback。',
    ' * - 但主进程只调用 formatSystemError / formatSystemHttpError（走 getErrorTranslation），',
    ' *   **不经过本函数**。真正会执行到这里的只有渲染层的 formatUserError / formatHttpError。',
    ' * - 结论：这不是"主进程里的定时炸弹"，而是「渲染层逻辑落在 shared/」的结构遗留。',
    ' *   若将来主进程需要 i18n，应改为显式注入而不是 require 别名。',
    ' */',
    oldHead,
  ].join(NL),
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
}
