import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/tasks/tasksStore.ts'
let s = readFileSync(p, 'utf-8')
const before = s

const edits = [
  ['  assignee?: string\n', '  assignee?: string | null\n'],
  ['  dueAt?: number\n', '  dueAt?: number | null\n'],
  ['  completedAt?: number\n', '  completedAt?: number | null\n'],
  ['  result?: string\n', '  result?: string | null\n'],
]

for (const [from, to] of edits) {
  if (!s.includes(from)) {
    console.log('未命中: ' + JSON.stringify(from))
    continue
  }
  s = s.replace(from, to)
}

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动')
}
