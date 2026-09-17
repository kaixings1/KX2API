import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/tray.ts'
let s = readFileSync(p, 'utf-8')
const before = s

if (!s.includes("markAppQuitting } from './index'")) {
  s = s.replace(
    "import { getProxyStatus } from './ipc/handlers'",
    "import { getProxyStatus } from './ipc/handlers'\nimport { markAppQuitting } from './index'",
  )
}

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动')
}
