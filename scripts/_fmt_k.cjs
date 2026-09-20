const fs = require('node:fs')
const path = require('node:path')
// 检查 K 是否已有 humanBytes/humanDuration 类似工具
const root = 'D:/KX2API/src'
const pats = ['humanBytes', 'humanDuration', 'humanNumber', 'humanTime', 'toFixed(1)} (K|M|G|T|B)']
let count = 0
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) { if (name !== 'node_modules') walk(p) }
    else if (name.endsWith('.ts')) {
      let txt = ''
      try { txt = fs.readFileSync(p, 'utf8') } catch {}
      for (const pat of ['humanBytes', 'humanDuration', 'humanNumber', 'humanTime']) {
        if (txt.includes(pat)) { console.log('K has:', pat, 'in', p.replace('D:/KX2API/', '')); count++ }
      }
    }
  }
}
walk(root)
console.log('total matches:', count)