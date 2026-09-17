import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/tasks/tasksStore.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// ESM 产物里 require 未定义（main 构建输出 format: 'es'），
// 产物中该行原样保留：const dir = require("path").dirname(DATA_FILE);
// → 建任务时抛 "require is not defined"（且 saveAll 无人 catch，任务直接存不下）。
// 顶部已 `import { join } from 'path'`，改为显式导入 dirname 并直接调用。
s = s.replace("import { join } from 'path'", "import { join, dirname } from 'path'")
s = s.replace("  const dir = require('path').dirname(DATA_FILE)", '  const dir = dirname(DATA_FILE)')

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动（检查匹配）')
}
