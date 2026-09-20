const fs = require('node:fs')
const candidates = [
  'objectGroupBy', 'mergeUtils', 'strictFormatter', 'contentArray', 'intl',
  'html', 'jsonIO', 'semanticBoolean', 'semanticNumber', 'taggedId',
]
for (const base of candidates) {
  const src = `D:/src/utils/${base}.ts`
  let c = ''
  try { c = fs.readFileSync(src, 'utf8') } catch { console.log(`### ${base}: 缺失`); continue }
  console.log(`\n########## ${base}.ts (${c.split('\n').length}行) ##########`)
  console.log(c)
}