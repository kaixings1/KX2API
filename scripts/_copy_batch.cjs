const fs = require('node:fs')
const mods = [
  'objectGroupBy', 'xml', 'mergeUtils', 'strictFormatter', 'intl',
  'contentArray', 'taggedId', 'semanticBoolean', 'semanticNumber', 'jsonIO', 'html',
]
for (const m of mods) {
  const src = `D:/src/utils/${m}.ts`
  const dst = `D:/KX2API/src/utils/${m}.ts`
  fs.copyFileSync(src, dst)
  const lines = fs.readFileSync(dst, 'utf8').split('\n').length
  console.log(`COPIED ${m}.ts → ${lines}行`)
}