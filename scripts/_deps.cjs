// 读取候选文件的 import 依赖，判断是否为低依赖纯函数
const fs = require('node:fs')
const files = [
  'D:/src/utils/jsonRepair.ts',
  'D:/src/utils/frontmatterParser.ts',
  'D:/src/utils/diffParser.ts',
  'D:/src/utils/treeify.ts',
  'D:/src/utils/words.ts',
  'D:/src/utils/tokens.ts',
  'D:/src/utils/xml.ts',
  'D:/src/utils/yaml.ts',
  'D:/src/utils/semanticNumber.ts',
  'D:/src/utils/stringUtils.ts',
  'D:/src/utils/fileHash.ts',
  'D:/src/utils/hash.ts',
]
for (const f of files) {
  if (!fs.existsSync(f)) { console.log('MISSING ' + f); continue }
  const txt = fs.readFileSync(f, 'utf8')
  const lines = txt.split('\n')
  const imports = lines.filter(l => /^\s*import\b/.test(l)).map(l => l.trim()).slice(0, 12)
  console.log('==== ' + f.replace('D:/src/utils/', '') + '  [' + lines.length + ' lines]')
  for (const im of imports) console.log('   ' + im)
  if (imports.length === 0) console.log('   (no imports)')
}