import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// 关键词写在脚本内（避免 shell 传参被 MSYS2 按空格拆词）
const CHECKS = [
  { name: 'Bun 运行时 API', re: /\bBun\.(file|write|spawn|serve|env)\b/ },
  { name: 'node: 之外的裸 require', re: /(?<![\w.])require\s*\(/ },
  { name: '类型逃逸', re: /@ts-(ignore|expect-error|nocheck)/ },
  { name: 'Deno 运行时 API', re: /\bDeno\.(readFile|writeFile|serve|env)\b/ },
  { name: '同步读流（易挂起）', re: /readFileSync\(\s*['"]\/dev/ },
  { name: 'TODO/FIXME 遗留', re: /\b(TODO|FIXME|XXX|HACK)\b/ },
  { name: '调试遗留 console.log', re: /console\.log\(\s*['"]debug/i },
  { name: '硬编码本地端口', re: /127\.0\.0\.1:(\d{4})/ },
]

const root = process.argv[2] || 'src'
const results = new Map(CHECKS.map(c => [c.name, []]))

function walk(dir) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === '__tests__') continue
      walk(full)
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      let txt
      try { txt = readFileSync(full, 'utf-8') } catch { continue }
      const lines = txt.split(/\r?\n/)
      for (let i = 0; i < lines.length; i++) {
        for (const c of CHECKS) {
          if (c.re.test(lines[i])) results.get(c.name).push(`${full}:${i + 1}`)
        }
      }
    }
  }
}

walk(root)
for (const [name, arr] of results) {
  console.log(`${String(arr.length).padStart(4)}  ${name}`)
  if (arr.length > 0 && arr.length <= 12) {
    for (const h of arr) console.log(`        ${h}`)
  }
}
