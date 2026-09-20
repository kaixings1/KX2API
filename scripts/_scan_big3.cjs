const fs = require('node:fs')
const path = require('node:path')
const candidates = [
  'combinedAbortSignal', 'withResolvers', 'cron', 'lockfile', 'tempfile',
  'queryContext', 'lineMapper', 'plans', 'semanticNumber', 'stream',
  'classifier', 'queueProcessor', 'sequential', 'semver', 'statistics',
  'circularBuffer', 'sleep', 'functions', 'retry', 'limiter',
]
const all = fs.readdirSync('D:/src/utils').filter(f => /\.ts$/.test(f) && !f.endsWith('.d.ts') && !f.endsWith('.verify.ts'))
const fileSet = new Set(all)
console.log('=== 候选文件是否存在 ===')
for (const c of candidates) {
  if (fileSet.has(c + '.ts')) {
    const p = 'D:/src/utils/' + c + '.ts'
    const n = fs.readFileSync(p, 'utf8').split('\n').length
    console.log(`${c}.ts (${n}行)`)
  }
}
// K 侧 src/utils 与 D 的交集
const kUtils = new Set(fs.readdirSync('D:/KX2API/src/utils').filter(f => f.endsWith('.ts')))
const overlap = all.filter(f => kUtils.has(f))
console.log('\n=== D 与 K(src/utils) 已交集 ===')
console.log(overlap.join(', ') || '(空)')