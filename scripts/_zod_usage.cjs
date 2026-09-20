const fs = require('node:fs')
const path = require('node:path')
const files = []
;(function walk(d) { const es = fs.readdirSync(d, { withFileTypes: true }); for (const e of es) { if (e.name === 'node_modules') continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.tsx?$/.test(e.name)) files.push(p) } })('D:/KX2API/src')
let count = 0
for (const f of files) {
  try {
    const t = fs.readFileSync(f, 'utf8')
    for (const m of t.matchAll(/from\s*['"]zod[^'"]*['"]/g)) {
      console.log(m[0] + '  ← ' + f.replace('D:/KX2API/',''))
      count++
    }
  } catch {}
}
console.log('共 ' + count + ' 处 zod import')