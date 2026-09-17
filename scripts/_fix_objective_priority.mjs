import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/ipc/chat-handlers.ts'
let s = readFileSync(p, 'utf-8')
const before = s

const re =
  /      const report = await orchestrator\.execute\(\{\r?\n        id: 'team-' \+ Date\.now\(\),\r?\n        description,\r?\n      \}\)/

if (!re.test(s)) {
  console.log('未命中 execute 调用')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '      const report = await orchestrator.execute({',
    "        id: 'team-' + Date.now(),",
    '        description,',
    '        // Objective.priority 必填；约定数值越大越优先，普通互动取中位',
    '        priority: 5,',
    '      })',
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
