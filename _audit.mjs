import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const APP_ENTRIES = ['src/main/index.ts', 'src/preload/index.ts', 'src/renderer/index.html', 'src/renderer/src/main.tsx']
const ALIASES = [['@shared/', 'src/shared/'], ['@/', 'src/renderer/src/']]
const EXT_TRY = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.md', '.html', '.svg', '.png', '.node']
const INDEX_TRY = ['index.ts', 'index.tsx', 'index.js', 'index.mjs', 'index.json']
const IMPORT_RE = /(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g
const read = (f) => { try { return fs.readFileSync(f, 'utf8') } catch { return '' } }

function tryResolve(fromFile, spec) {
  const bases = []
  if (spec.startsWith('.')) bases.push(path.resolve(path.dirname(fromFile), spec))
  else for (const [a, t] of ALIASES) if (spec.startsWith(a)) { bases.push(path.resolve(root, t + spec.slice(a.length))); break }
  for (const b of bases) {
    for (const ext of EXT_TRY) { const p = b + ext; if (fs.existsSync(p) && fs.statSync(p).isFile()) return p }
    for (const i of INDEX_TRY) { const p = path.join(b, i); if (fs.existsSync(p) && fs.statSync(p).isFile()) return p }
  }
  return null
}
function trace(entries) {
  const seen = new Set(); const stack = entries.map(e => path.join(root, e)).filter(f => fs.existsSync(f))
  while (stack.length) {
    const f = stack.pop(); if (seen.has(f)) continue; seen.add(f)
    for (const m of read(f).matchAll(IMPORT_RE)) {
      const spec = m[1]
      if (spec.startsWith('bun:') || spec.startsWith('node:')) continue
      if (!spec.startsWith('.') && !ALIASES.some(([a]) => spec.startsWith(a))) continue
      const hit = tryResolve(f, spec); if (hit) stack.push(hit)
    }
  }
  return new Set([...seen].map(p => path.resolve(p)))
}
const app = trace(APP_ENTRIES)

function importers(target) {
  const base = target.replace(/^src\//, '').replace(/\.(ts|tsx)$/, '').split('/').pop()
  const hits = new Set()
  const walk = (dir) => {
    let entries = []
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'out') continue
      const full = path.join(dir, e.name)
      if (e.isDirectory()) { walk(full); continue }
      if (!/\.(ts|tsx|mjs|js)$/.test(e.name)) continue
      if (path.resolve(full) === path.resolve(target)) continue
      const c = read(full)
      if (new RegExp(`from\\s+['"][^'"]*${base}(\\.tsx?)?['"]`).test(c)) hits.add(full.replace(/\\/g, '/'))
    }
  }
  walk('src'); walk('tests')
  return [...hits]
}

const targets = process.argv.slice(2)
for (const t of targets) {
  if (!fs.existsSync(t)) { console.log(`\n${t}  ❌ 不存在`); continue }
  const abs = path.resolve(t)
  const deps = importers(t)
  console.log(`${t}  (${fs.statSync(t).size}B)  可达:${app.has(abs) ? '✅' : '—'}  被引用:${deps.length ? deps.slice(0, 3).join(',') : '无'}`)
}
