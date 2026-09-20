const fs = require('node:fs')
// 要复制的模块 —— 检查具体 import 行
const candidates = [
  'array', 'uuid', 'set', 'contentArray', 'taggedId', 'hash', 'objectGroupBy',
  'xml', 'intl', 'mergeUtils', 'strictFormatter', 'jsonIO', 'semanticBoolean',
  'semanticNumber', 'html', 'textUtils', 'pathResolution', 'stringify', 'messageFormat',
]
for (const base of candidates) {
  const src = `D:/src/utils/${base}.ts`
  let content = ''
  try { content = fs.readFileSync(src, 'utf8') } catch { continue }
  const lines = content.split('\n')
  console.log(`=== ${base}.ts (${lines.length}行) ===`)
  for (const l of lines) {
    if (/^\s*import\b/.test(l) || /^\s*export\s+.*\bfrom\b|node:|require\(/.test(l)) {
      console.log('  ' + l)
    }
  }
}