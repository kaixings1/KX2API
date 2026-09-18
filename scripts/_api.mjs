import { readFileSync } from 'node:fs'

// 列出 TS 文件里所有「导出/类方法」签名，用于快速摸清公开接口。
// 关键词写在脚本内，避免 shell 按空格拆词。
const file = process.argv[2]
const txt = readFileSync(file, 'utf-8')
const lines = txt.split(/\r?\n/)

const patterns = [
  { name: '导出函数', re: /^export\s+(async\s+)?function\s+(\w+)/ },
  { name: '导出类', re: /^export\s+class\s+(\w+)/ },
  { name: '导出常量', re: /^export\s+const\s+(\w+)/ },
  { name: '公开方法', re: /^  (async\s+)?(\w+)\s*[(<]/ },
  { name: '静态方法', re: /^  static\s+(async\s+)?(\w+)/ },
]

const out = []
for (let i = 0; i < lines.length; i++) {
  const l = lines[i]
  for (const p of patterns) {
    const m = p.re.exec(l)
    if (m) {
      const name = m[m.length - 1]
      // 排掉关键词误命中
      if (['if', 'for', 'while', 'switch', 'return', 'const', 'let'].includes(name)) continue
      out.push(`${String(i + 1).padStart(5)}  [${p.name}] ${l.trim().slice(0, 120)}`)
      break
    }
  }
}

console.log(out.join('\n'))
console.log(`--- ${out.length} 项 ---`)
