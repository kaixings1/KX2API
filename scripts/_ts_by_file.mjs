/**
 * 类型错误按文件聚类（用于逐个击破）。
 *
 * 输出：错误最多的文件 Top N，附该文件的错误码分布与样例。
 * 目的：找"同一文件里十几处"的位置 —— 那往往是同一类根因，一次能修一批。
 */
import { execSync } from 'node:child_process'
import { writeFileSync, readFileSync } from 'node:fs'

execSync('npx tsc -p tsconfig.check.json --noEmit > .ts_report.txt 2>&1 || true', {
  stdio: 'inherit',
})

const RE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/
const byFile = new Map()
let total = 0

for (const raw of readFileSync('.ts_report.txt', 'utf-8').split('\n')) {
  const m = RE.exec(raw.trim())
  if (!m) continue
  total++
  const [, file, line, , code, msg] = m
  if (!byFile.has(file)) byFile.set(file, [])
  byFile.get(file).push({ line: Number(line), code, msg: msg.trim() })
}

console.log(`错误总数: ${total}，涉及文件: ${byFile.size}\n`)
console.log('=== 错误最多的 20 个文件 ===')
const sorted = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)
for (const [file, errs] of sorted.slice(0, 20)) {
  const codes = new Map()
  for (const e of errs) codes.set(e.code, (codes.get(e.code) ?? 0) + 1)
  const codeStr = [...codes.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${c}×${n}`)
    .join(' ')
  console.log(`${String(errs.length).padStart(4)}  ${file}`)
  console.log(`      ${codeStr}`)
}

writeFileSync('.ts_report.txt', '', 'utf-8')
