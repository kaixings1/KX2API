import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/window/manager.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// 1) details.responseHeaders 是可选字段（TS2769：Object.entries 不能吃 undefined）
s = s.replace(
  /      for \(const \[key, value\] of Object\.entries\(details\.responseHeaders\)\) \{/,
  '      for (const [key, value] of Object.entries(details.responseHeaders ?? {})) {',
)

// 2) app.isQuitting 不是 Electron App 的成员（TS2339）。
//    主进程已有单一真源：src/main/index.ts 的 isAppQuitting() / markAppQuitting()。
//    这里改用本地标记 + 由退出流程显式设置，避免模块增强 hack。
s = s.replace(
  '    if (!app.isQuitting) {',
  '    if (!isQuitting) {',
)

// 插入本地状态与 setter
const anchor = 'let mainWindow: BrowserWindow | null = null\r\n'
const anchorLF = 'let mainWindow: BrowserWindow | null = null\n'
const insert = [
  'let mainWindow: BrowserWindow | null = null',
  '',
  '/**',
  ' * 应用是否正在退出。',
  ' *',
  ' * Electron 的 App 类型没有 isQuitting 字段；原先的模块增强（types/electron.d.ts）',
  ' * 与 src/main/index.ts 的写法并存且互相冲突，故这里改为本模块自持状态：',
  ' * 「正在退出」是应用自己的状态，由退出流程调用 markQuitting() 标记。',
  ' */',
  'let isQuitting = false',
  '',
  'export function markQuitting(): void {',
  '  isQuitting = true',
  '}',
  '',
  'export function isQuittingApp(): boolean {',
  '  return isQuitting',
  '}',
  '',
].join('\r\n')

let used = null
if (s.includes(anchor)) used = anchor
else if (s.includes(anchorLF)) used = anchorLF

if (!used) {
  console.log('未命中 mainWindow 声明')
  process.exit(1)
}

s = s.replace(used, s.includes(anchor) ? insert : insert.replace(/\r\n/g, '\n'))

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动')
}
