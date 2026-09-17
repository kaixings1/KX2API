import { readFileSync, writeFileSync } from 'node:fs'

const p = 'electron.vite.config.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// electron-vite 要求 main 配置里有 build.lib.entry（或 build.rollupOptions.input）。
// 当前只有 rollupOptions.input，但 electron-vite 的 configResolved 会先校验 lib.entry，
// 于是 `npm run build` 直接报 "An entry point is required in the electron vite main config"。
const re =
  /    build: \{\r?\n      rollupOptions: \{\r?\n        input: \{\r?\n          index: resolve\(__dirname, 'src\/main\/index\.ts'\)\r?\n        \},\r?\n        output: \{\r?\n          format: 'es'\r?\n        \}\r?\n      \}\r?\n    \}/

if (!re.test(s)) {
  console.log('未命中 main.build 块')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '    build: {',
    '      // electron-vite 需要显式入口：lib.entry 既可被其校验器识别，',
    "      // 也等价于此前的 rollupOptions.input（缺失时构建直接失败）。",
    '      lib: {',
    "        entry: resolve(__dirname, 'src/main/index.ts'),",
    '      },',
    '      rollupOptions: {',
    '        output: {',
    "          format: 'es'",
    '        }',
    '      }',
    '    }',
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
