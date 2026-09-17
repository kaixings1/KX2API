import { readFileSync, existsSync } from 'node:fs'

// 检查构建产物里是否残留 require( —— 这决定「裸 require」在运行时是否真的会崩
const files = ['out/main/index.js']
for (const f of files) {
  if (!existsSync(f)) {
    console.log(`(不存在) ${f}`)
    continue
  }
  const txt = readFileSync(f, 'utf-8')
  const lines = txt.split('\n')
  const hits = []
  for (let i = 0; i < lines.length; i++) {
    if (/(?<![\w.])require\s*\(/.test(lines[i])) {
      hits.push(`${i + 1}: ${lines[i].trim().slice(0, 160)}`)
    }
  }
  console.log(`===== ${f}：require( 命中 ${hits.length} 处 =====`)
  console.log(hits.slice(0, 30).join('\n'))
}
