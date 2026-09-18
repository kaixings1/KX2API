import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/adapters/glm.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// 注入工具调用时产出的名字，改为本项目注册命令名（原为 Claude 风格名，
// 在 commandRunners 注册表里不存在 → 注入出去的工具客户端也调不通）。
const pairs = [
  ["GLMStreamHandler.toolFingerprint('Bash', bashArgs)", "GLMStreamHandler.toolFingerprint('bash', bashArgs)"],
  ["return { name: 'Bash', arguments: bashArgs }", "return { name: 'bash', arguments: bashArgs }"],
  ['name=Bash args=', 'name=bash args='],
  ["GLMStreamHandler.toolFingerprint('Read', readArgs)", "GLMStreamHandler.toolFingerprint('cat', readArgs)"],
  ["return { name: 'Read', arguments: readArgs }", "return { name: 'cat', arguments: readArgs }"],
  ['name=Read args=', 'name=cat args='],
]

let n = 0
for (const [from, to] of pairs) {
  const count = s.split(from).length - 1
  if (count > 0) {
    s = s.split(from).join(to)
    n += count
  }
}

s = s.split('注入 Read 读取该文件').join('注入 cat 读取该文件')
s = s.split('无条件注入 Read 该文件').join('无条件注入 cat 该文件')

if (s !== before) {
  writeFileSync(p, s)
  console.log(`已改: ${p}（${n} 处）`)
}
