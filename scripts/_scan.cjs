// 扫描 D:/src/utils 中零 value-import（纯函数类）的模块
const fs = require('node:fs')
const path = require('node:path')
const dir = 'D:/src/utils'
const out = []
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.ts')) continue
  const p = path.join(dir, f)
  if (!fs.statSync(p).isFile()) continue
  const txt = fs.readFileSync(p, 'utf8')
  const lines = txt.split('\n')
  // 值导入（排除 type import / 内置 node 模块）
  const valueImports = lines.filter(l => /^\s*import\b/.test(l) && !/^\s*import\s+type/.test(l) && !/from\s+'(node:|crypto|fs|path|os|util|url|stream|events|child_process|readline|assert|querystring)'/.test(l))
  const isPureish = valueImports.every(l => {
    const m = l.match(/from\s+'([^']+)'/)
    return m && m[1].startsWith('.') ? false : true // 相对路径导入视为依赖
  })
  // 分类：无相对 import（相对路径 = 内部依赖）
  const relImports = lines.filter(l => /^\s*import\b/.test(l) && !/^\s*import\s+type/.test(l) && /from\s+'\.\.?\/'/.test(l))
  if (relImports.length === 0 && valueImports.length === 0) {
    out.push([f, lines.length, 'ZERO-IMPORT'])
  } else if (relImports.length === 0 && valueImports.length > 0) {
    out.push([f, lines.length, 'ONLY-BUILTIN:' + valueImports.length])
  }
}
for (const [f, l, tag] of out.sort((a,b)=>b[1]-a[1])) {
  console.log(String(l).padStart(5) + '  ' + f.padEnd(28) + tag)
}
console.log('count:', out.length)