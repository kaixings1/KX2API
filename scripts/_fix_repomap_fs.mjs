import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/repoMap.ts'
let s = readFileSync(p, 'utf-8')
const before = s

const oldBlock =
  'const fs = { existsSync: (_p?: string): boolean => true };\r\n' +
  'const expandPath = (p: string) => p;\r\n' +
  'const getFsImplementation = () => fs;\r\n'

const oldBlockLF = oldBlock.replace(/\r\n/g, '\n')

const newBlock = [
  '// 真实 fs 适配层。',
  '//',
  '// 原实现是 `const fs = { existsSync: () => true }` 这样的残缺桩：existsSync 恒真，',
  '// 且完全没有 readFile / stat。结果是 repoMap 自己的符号扫描全部落空，',
  '// 而依赖同一适配层的 codeVectorStore 一调用 index() 就崩（TS2339）。',
  '// 这里换成 node:fs/promises 的真实异步实现，两个模块一起恢复可用。',
  'const fs = {',
  '  existsSync: (p?: string): boolean => {',
  "    if (!p) return false;",
  '    try {',
  "      return existsSyncSync(p);",
  '    } catch {',
  '      return false;',
  '    }',
  '  },',
  '  readFile: (p: string, enc?: BufferEncoding): Promise<string> =>',
  '    enc ? readFile(p, { encoding: enc }) : readFile(p, { encoding: "utf-8" }),',
  '  stat: (p: string) => stat(p),',
  '};',
  'const expandPath = (p: string) => p;',
  'const getFsImplementation = () => fs;',
  '',
].join('\r\n')

let used = null
if (s.includes(oldBlock)) used = oldBlock
else if (s.includes(oldBlockLF)) used = oldBlockLF

if (!used) {
  console.log('未命中 fs 桩块')
  process.exit(1)
}

s = s.replace(used, newBlock)

// 补 fs 导入
const impOld = "import { readdir, readFile } from 'node:fs/promises';\r\n"
const impOldLF = impOld.replace(/\r\n/g, '\n')
const impNew =
  "import { readdir, readFile, stat } from 'node:fs/promises';\r\n" +
  "import { existsSync as existsSyncSync } from 'node:fs';\r\n"

if (s.includes(impOld)) s = s.replace(impOld, impNew)
else if (s.includes(impOldLF)) s = s.replace(impOldLF, impNew.replace(/\r\n/g, '\n'))
else console.log('注意: 未命中 import 行')

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
}
