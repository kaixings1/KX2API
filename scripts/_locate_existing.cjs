const fs = require('node:fs')
const path = require('node:path')
const kRoot = 'D:/KX2API/src'
const files = []
;(function walk(d) {
  let entries
  try { entries = fs.readdirSync(d, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (e.name === 'node_modules') continue
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.tsx?$/.test(e.name)) files.push(p)
  }
})(kRoot)
const names = ['intersperse', 'uniq', 'difference', 'intersects', 'union', 'every']
for (const f of files) {
  try {
    const t = fs.readFileSync(f, 'utf8')
    for (const name of names) {
      const rx = new RegExp(
        'export\\s+(?:function|const)\\s+' + name + '\\b|export\\s*\\{[^}]*\\b' + name + '\\b',
      )
      if (rx.test(t)) {
        // 找到具体行号
        const lineIdx = t.split('\n').findIndex((l) => new RegExp('\\b' + name + '\\b').test(l) && /export/.test(l))
        console.log(`${name} → ${f.replace('D:/KX2API/', '')}:${lineIdx + 1}`)
      }
    }
  } catch {}
}