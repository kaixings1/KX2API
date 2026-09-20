const fs = require('node:fs')
const mods = [
  'combinedAbortSignal','withResolvers','lockfile','tempfile','sequential',
  'sleep','queueProcessor','stream','signal','generators','emoji','net',
]
for (const base of mods) {
  const p = `D:/src/utils/${base}.ts`
  let t = ''
  try { t = fs.readFileSync(p, 'utf8') } catch { console.log(`=${base} 缺失`); continue }
  const lines = t.split('\n')
  const deps = []
  for (const l of lines) {
    const m = l.match(/^\s*import\b.*?from\s+['"]([^'"]+)['"]/)
    if (m && !m[1].startsWith('./') && !m[1].startsWith('../')) deps.push(m[1])
    const mn = l.match(/import\s+['"]([^'"]+)['"]/)
    if (mn && !mn[1].startsWith('./') && !mn[1].startsWith('../')) deps.push(mn[1])
  }
  console.log(`${base}.ts (${lines.length}) 外依: ${deps.length?deps.join(','):'无'}`)
}