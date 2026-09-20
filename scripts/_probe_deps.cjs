// 检查更多高价值候选的依赖
const fs = require('node:fs')
const files = [
  'D:/src/utils/formatUtils.ts',
  'D:/src/utils/diff.ts',
  'D:/src/utils/asciicast.ts',
  'D:/src/utils/frontmatterParser.ts',
  'D:/src/utils/path.ts',
  'D:/src/utils/semanticNumber.ts',
  'D:/src/utils/words.ts',
  'D:/src/utils/json.ts',
  'D:/src/utils/fileHash.ts',
  'D:/src/utils/treeify.ts',
]
for (const f of files) {
  if (!fs.existsSync(f)) { console.log('MISSING ' + f); continue }
  const txt = fs.readFileSync(f, 'utf8')
  const lines = txt.split('\n')
  const imports = lines.filter(l => /^\s*import\b/.test(l) && !/^import\s+type/.test(l)).map(l => l.trim()).slice(0, 10)
  console.log('==== ' + f.replace('D:/src/utils/', '') + '  [' + lines.length + ']')
  console.log(imports.length ? imports.join('\n') : '   (no value imports)')
}