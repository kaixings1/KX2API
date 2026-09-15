const fs = require('fs')
const path = require('path')
function walk(dir, out) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/tsconfig.*\.json$/.test(e.name)) out.push(p)
  }
}
const out = []
walk('.', out)
console.log(out.join('\n'))