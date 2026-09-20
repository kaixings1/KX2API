const fs = require('node:fs')
const src = 'D:/src/utils/stringUtils.ts'
const dst = 'D:/KX2API/src/utils/stringUtils.ts'
fs.copyFileSync(src, dst)
const txt = fs.readFileSync(dst, 'utf8')
console.log('exists:', fs.existsSync(dst), '| lines:', txt.split('\n').length, '| size:', fs.statSync(dst).size)
const fns = txt.split('\n').filter(l => /^export (function|class)/.test(l)).map(l => l.trim())
console.log('exports:')
fns.forEach(e => console.log('  ' + e))