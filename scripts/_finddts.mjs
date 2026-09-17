import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2] || 'src'
const hits = []
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue
      walk(full)
    } else if (e.name.endsWith('.d.ts')) {
      hits.push(full)
    }
  }
}
walk(root)
console.log(hits.join('\n'))
console.log('--- 共 ' + hits.length + ' 个 ---')
