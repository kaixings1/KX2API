const fs = require('node:fs')
const src = 'D:/src/utils/formatUtils.ts'
const dst = 'D:/KX2API/src/utils/formatUtils.ts'
fs.copyFileSync(src, dst)
const txt = fs.readFileSync(dst, 'utf8')
console.log('copied exists:', fs.existsSync(dst))
console.log('lines:', txt.split('\n').length, 'size:', fs.statSync(dst).size)
const fns = txt.split('\n').filter(l => /^export function/.test(l)).map(l => l.trim())
console.log('exports:', fns.length)
fns.forEach(e => console.log('  ' + e))