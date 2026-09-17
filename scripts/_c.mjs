/**
 * 类型错误按文件聚类。
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

execSync('npx tsc -p tsconfig.check.json --noEmit > .ts_x.txt 2>&1 || true', { stdio: 'inherit' })

const RE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/
const byFile = new Map()
let total = 0

for (const raw of readFileSync('.ts_x.txt', 'utf-8').split('\n')) {
  const m = RE.exec(raw.trim())
  if (!m) continue
  total++
  const [, file, line, , code, msg] = m
  if (!byFile.has(file)) byFile.set(file, [])
  byFile.get(file).push({ line: Number(line), code, msg: msg.trim() })
}

console.log(`错误总数: ${total}，文件: ${byFile.size}\n`)
for (const [file, errs] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 18)) {
  const codes = new Map()
  for (const e of errs) codes.set(e.code, (codes.get(e.code) ?? 0) + 1)
  const cs = [...codes.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}×${n}`).join(' ')
  console.log(`${String(errs.length).padStart(4)}  ${file.replace('src/', '')}`)
  console.log(`      ${cs}`)
}
