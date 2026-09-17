import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/codeVectorStore.ts'
let s = readFileSync(p, 'utf-8')
const before = s

const re =
  /const matches = await ripGrep\(\{\r?\n\s*rootDir: this\.rootDir,\r?\n\s*pattern: '',\r?\n\s*glob: pattern,\r?\n\s*type: 'files',\r?\n\s*maxMatches: 200,\r?\n\s*\}\)/

if (!re.test(s)) {
  console.log('未命中 ripGrep 调用')
  process.exit(1)
}

// repoMap 导出的 ripGrep 签名是 (args: string[], cwdOrFile, signal?)，
// 不是对象参数。这里改按真实签名调用：--files + --glob。
s = s.replace(
  re,
  "const matches = await ripGrep(['--files', '--glob', pattern], this.rootDir)",
)

// 顺手去掉一处“取了 stat 却完全没用”的死代码（会触发 noUnusedLocals 类噪声，
// 且其本意是「索引时再查大小」，注释已写明）
const deadStat = /            const stat = fs\.stat\(fullPath\)\.catch\(\(\) => null\)\r?\n            \/\/ We'll check size during indexing\r?\n/
if (deadStat.test(s)) {
  s = s.replace(
    deadStat,
    '            // 文件大小在索引阶段统一检查（此处不再预取 stat）\r\n',
  )
}

writeFileSync(p, s)
console.log('已改: ' + p)
