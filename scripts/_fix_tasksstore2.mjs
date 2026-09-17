import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/tasks/tasksStore.ts'
let s = readFileSync(p, 'utf-8')

const from = "  priority: 'low' | 'medium' | 'high'\n  assignee?: string | null\n"
const to =
  "  priority: 'low' | 'medium' | 'high'\n" +
  '  // 以下字段落盘时会显式写 null（表示「明确了：目前没有」），\n' +
  '  // 与「字段缺失」的 undefined 语义不同，故类型允许 null。\n' +
  '  assignee?: string | null\n'

if (!s.includes(from)) {
  console.log('未命中')
  process.exit(1)
}
s = s.replace(from, to)
writeFileSync(p, s)
console.log('已改: ' + p)
