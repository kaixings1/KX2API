// 对比 D:/src/utils 与 KX2API 已有模块，识别缺失的高价值纯函数模块
const fs = require('node:fs')
const path = require('node:path')

function tsFiles(dir) {
  const out = {}
  if (!fs.existsSync(dir)) return out
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.ts')) continue
    const p = path.join(dir, f)
    if (!fs.statSync(p).isFile()) continue
    out[f] = true
  }
  return out
}

// K2 已有文件（按目录）
const kDirs = {
  utils: 'D:/KX2API/src/utils',
  engine: 'D:/KX2API/src/engine',
  memory: 'D:/KX2API/src/memory',
  shared: 'D:/KX2API/src/shared',
}
const kFiles = {}
for (const [k, d] of Object.entries(kDirs)) kFiles[k] = tsFiles(d)

// 高价值纯函数候选（D:/src/utils 中，标注用途）
const candidates = [
  'words.ts', 'treeify.ts', 'frontmatterParser.ts', 'diffParser.ts', 'jsonRepair.ts',
  'semver.ts', 'modelCost.ts', 'truncate.ts', 'fileHash.ts', 'hash.ts',
  'set.ts', 'array.ts', 'xml.ts', 'yaml.ts', 'tokens.ts', 'semanticNumber.ts',
  'semanticBoolean.ts', 'objectGroupBy.ts', 'frontmatterParser.ts', 'stringUtils.ts',
]

console.log('==== 高价值候选在 K 中是否已存在 ====')
for (const c of candidates) {
  const inK = Object.values(kFiles).some(d => d[c] || d[c.replace('.ts', '.test.ts')])
  const inD = fs.existsSync('D:/src/utils/' + c)
  console.log((inK ? '[已有] ' : '[缺口] ') + c.padEnd(24) + '  D:' + (inD ? '有' : '无'))
}

console.log('\n==== K2 src/utils 现有文件 ====')
console.log(Object.keys(kFiles.utils).sort().join('\n'))

console.log('\n==== K2 src/engine 现有文件 ====')
console.log(Object.keys(kFiles.engine).sort().join('\n'))