import { readFileSync, writeFileSync } from 'node:fs'

// 三处 `(app as any).isQuitting = true` 是在绕类型（App 上没这个字段）。
// 主进程已有唯一真源 markAppQuitting()（src/main/index.ts），统一过去。
const targets = [
  'src/main/tray/TrayManager.ts',
  'src/main/tray.ts',
]

for (const p of targets) {
  let s = readFileSync(p, 'utf-8')
  const before = s

  const n = (s.match(/\(app as any\)\.isQuitting = true/g) || []).length
  s = s.replace(/;?\(app as any\)\.isQuitting = true/g, 'markAppQuitting()')

  // 补导入
  if (n > 0 && !s.includes("markAppQuitting } from '../index'") && !s.includes("markAppQuitting } from './index'")) {
    const rel = p.includes('/') ? p.split('/').slice(0, -1).join('/') : '.'
    const depth = p === 'src/main/tray.ts' ? './index' : '../index'
    if (s.includes("import { IpcChannels } from '../ipc/channels'")) {
      s = s.replace(
        "import { IpcChannels } from '../ipc/channels'",
        "import { IpcChannels } from '../ipc/channels'\nimport { markAppQuitting } from '../index'",
      )
    }
  }

  if (s !== before) {
    writeFileSync(p, s)
    console.log(`已改: ${p}（${n} 处）`)
  } else {
    console.log('无改动: ' + p)
  }
}
