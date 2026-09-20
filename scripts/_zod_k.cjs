const fs = require('node:fs')
const path = require('node:path')
const root = 'D:/KX2API/src'
let hit = 0
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) { if (name !== 'node_modules') walk(p) }
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) {
      let txt = ''
      try { txt = fs.readFileSync(p, 'utf8') } catch {}
      if (/from 'zod'|from 'zod\/v4'|require\('zod'\)/.test(txt)) {
        console.log('zod used in:', p.replace('D:/KX2API/', ''))
        hit++
      }
    }
  }
}
walk(root)
console.log('zod usage sites:', hit)
// K 用 zod 版本
try {
  const pkg = JSON.parse(fs.readFileSync('D:/KX2API/package.json', 'utf8'))
  console.log('zod dep:', pkg.dependencies?.zod || pkg.devDependencies?.zod || 'NOT in deps')
} catch(e) { console.log('pkg err', e.message) }