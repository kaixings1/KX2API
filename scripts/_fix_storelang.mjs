import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/store/types.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// shared/types 的 AppConfig 有 language（渲染层用它做中英切换），
// store 版漏了 —— 于是托盘菜单读 config.language 时类型报错（TrayManager.ts:173），
// 运行时也拿不到值。这里补上，与 shared 版对齐。
const re = /  mcp\?: McpConfig\r?\n\}/

if (!re.test(s)) {
  console.log('未命中 mcp 结尾')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '  mcp?: McpConfig',
    '  /**',
    '   * 界面语言。',
    '   * 与 shared/types 的 AppConfig.language 保持一致（托盘菜单据此切中英文）。',
    '   */',
    "  language?: 'zh-CN' | 'en-US'",
    '}',
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
