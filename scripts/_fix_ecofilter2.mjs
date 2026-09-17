import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/ecoFilter.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 上一步的插入点算错，把 import 塞进了文件头注释块内部。挪到注释块之后。
const broken = [
  '/**',
  "import { existsSync, mkdirSync, appendFileSync } from 'node:fs'",
  "import { dirname } from 'node:path'",
  ' * engine/ecoFilter.ts — Bash 输出压缩过滤器',
].join(NL)

const brokenLF = broken.replace(/\r\n/g, '\n')

const fixed = [
  '/**',
  ' * engine/ecoFilter.ts — Bash 输出压缩过滤器',
].join(NL) + NL +
  "import { existsSync, mkdirSync, appendFileSync } from 'node:fs'" + NL +
  "import { dirname } from 'node:path'"

if (s.includes(broken)) s = s.replace(broken, fixed)
else if (s.includes(brokenLF)) s = s.replace(brokenLF, fixed.replace(/\r\n/g, '\n'))
else {
  console.log('未命中损坏块，请人工核对')
  process.exit(1)
}

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
}
