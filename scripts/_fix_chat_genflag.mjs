import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/routes/chat.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// wrapperStream 是 PassThrough，代码给它挂了自定义标记，供 server.ts:96
// 经 ctx.body 读取并打 '(gen)' 标签。这里用局部交叉类型表达，避免 any。
const re =
  /      \/\/ Propagate generatedByProxy flag for server middleware logging\r?\n      if \(result\.generatedByProxy\) \{\r?\n        wrapperStream\.generatedByProxy = true\r?\n      \}/

if (!re.test(s)) {
  console.log('未命中 generatedByProxy 块')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '      // Propagate generatedByProxy flag for server middleware logging.',
    '      // PassThrough 本身没有该字段，是运行时挂在流上的自定义标记，',
    '      // 由 server.ts 经 ctx.body 读取（(gen) 标签）。',
    '      if (result.generatedByProxy) {',
    '        ;(wrapperStream as PassThrough & { generatedByProxy?: boolean }).generatedByProxy = true',
    '      }',
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
