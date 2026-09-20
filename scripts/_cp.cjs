const fs = require('node:fs')
const src = 'D:/src/utils/words.ts'
const dst = 'D:/KX2API/src/utils/words.ts'
fs.copyFileSync(src, dst)
const txt = fs.readFileSync(dst, 'utf8')
console.log('copied', dst, 'lines:', txt.split('\n').length, '| import line:', txt.split('\n').find(l => l.includes('import')))
// 检查导出函数
console.log('has generateWordSlug:', txt.includes('export function generateWordSlug'))
console.log('has generateShortWordSlug:', txt.includes('export function generateShortWordSlug'))