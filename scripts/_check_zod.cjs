const p = require('D:/KX2API/package.json')
console.log('zod (deps):', p.dependencies.zod || 'NOT')
console.log('zod (dev):', p.devDependencies.zod || 'NOT')
// check intl functions already exist anywhere in K
const fs = require('node:fs')
const path = require('node:path')
const kRoot = 'D:/KX2API/src'
const files = []
;(function walk(d) { const es = fs.readdirSync(d, { withFileTypes: true }); for (const e of es) { if (e.name === 'node_modules') continue; const p2 = path.join(d, e.name); if (e.isDirectory()) walk(p2); else if (/\.tsx?$/.test(e.name)) files.push(p2) } })(kRoot)
const names = ['getGraphemeSegmenter','firstGrapheme','lastGrapheme','getWordSegmenter','getRelativeTime','getSystemLocaleLanguage','toTaggedId','insertBlockAfterToolResults','mergeDictionaries','StrictFormatter','escapeXml','slimdownHtml','looksLikeHtml','objectGroupBy','readJsonFile']
for (const n of names) {
  const hits = []
  for (const f of files) {
    try { const t = fs.readFileSync(f, 'utf8'); if (new RegExp('\\b' + n + '\\b').test(t)) hits.push(f.replace('D:/KX2API/','')) } catch {}
  }
  console.log(`${n.padEnd(28)} → ${hits.length ? '已存在: ' + hits[0] : '缺失'}`)
}