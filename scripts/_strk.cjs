const fs = require('node:fs')
const path = require('node:path')
const root = 'D:/KX2API/src'
const pats = ['escapeRegExp', 'truncateToLines', 'EndTruncatingAccumulator', 'normalizeFullWidthDigit', 'safeJoinLines', 'countCharInString']
const hits = {}
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) { if (name !== 'node_modules') walk(p) }
    else if (name.endsWith('.ts')) {
      let txt = ''
      try { txt = fs.readFileSync(p, 'utf8') } catch {}
      for (const pat of pats) {
        if (txt.includes(pat)) { (hits[pat] = hits[pat] || []).push(p.replace('D:/KX2API/', '')) }
      }
    }
  }
}
walk(root)
for (const pat of pats) {
  console.log(pat + ': ' + (hits[pat] ? hits[pat].join(', ') : 'NOT FOUND'))
}