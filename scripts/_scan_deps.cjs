const fs = require('node:fs')
// 要评估的候选模块
const candidates = [
  'array', 'uuid', 'set', 'contentArray', 'taggedId', 'hash', 'objectGroupBy',
  'xml', 'intl', 'mergeUtils', 'strictFormatter', 'truncate', 'yaml',
  'binaryCheck', 'jsonIO', 'semanticBoolean', 'semanticNumber', 'html',
  'textUtils', 'pathResolution',
]
for (const base of candidates) {
  const src = `D:/src/utils/${base}.ts`
  let content = ''
  try { content = fs.readFileSync(src, 'utf8') } catch { continue }
  const lines = content.split('\n')
  // 提取 import/require 依赖
  const deps = []
  for (const l of lines) {
    const m = l.match(/^\s*(?:import|export\s+.*\bfrom)\s*['"](\S+)['"]/)
    if (m && !m[1].startsWith('.')) deps.push(m[1])
    const m2 = l.match(/require\(\s*['"](\S+)['"]/)
    if (m2) deps.push(m2[1])
    if (l.includes("from './") || l.includes("from \"'./\"")) deps.push('(local)')
  }
  // 检查 Bun 依赖
  const hasBun = /Bun\.|typeof Bun/.test(content)
  console.log(`=== ${base}.ts (${lines.length}行) ===`)
  console.log(`  外部依赖: ${deps.length ? [...new Set(deps)].join(', ') : '无'}`)
  console.log(`  Bun 依赖: ${hasBun ? 'YES' : 'no'}`)
}