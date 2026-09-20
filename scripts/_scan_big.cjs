const fs = require('node:fs')
const path = require('node:path')

// 候选大模块
const candidates = [
  'textUtils', 'pathResolution', 'stringify', 'messageFormat',
  'markdown', 'html', 'truncate', 'binaryCheck', 'semanticBoolean',
  'diff', 'arrays_unknown', 'format', 'textUtils2',
]
// 先列出 D:/src/utils 中含 Utils/util 或有意义的较大文件
const all = fs.readdirSync('D:/src/utils').filter(f => /\.ts$/.test(f) && !f.endsWith('.d.ts'))
console.log('D:/src/utils .ts 文件总数:', all.length)
console.log('=== 较大文件（>150行）===')
for (const f of all) {
  const p = 'D:/src/utils/' + f
  const n = fs.readFileSync(p, 'utf8').split('\n').length
  if (n > 150) console.log(`${String(n).padStart(5)}行  ${f}`)
}
console.log('\n=== 专攻候选的 import 依赖 ===\n')
for (const c of candidates) {
  const p = `D:/src/utils/${c}.ts`
  try {
    const t = fs.readFileSync(p, 'utf8')
    const deps = []
    for (const line of t.split('\n')) {
      const m = line.match(/^\s*import\b.*?from\s+['"]([^'"]+)['"]/)
      if (m && !m[1].startsWith('./') && !m[1].startsWith('../')) deps.push(m[1])
    }
    console.log(`${c}.ts(${t.split('\n').length}) 外部依赖: ${deps.length ? deps.join(',') : '无'}`)
  } catch { console.log(`${c}.ts — 缺失`) }
}