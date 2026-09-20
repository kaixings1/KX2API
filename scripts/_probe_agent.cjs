// 探查 AgentTool 及 K2 引擎 agent 结构
const fs = require('node:fs')
const path = require('node:path')

function tree(dir, prefix = '', depth = 0) {
  if (depth > 3) return
  if (!fs.existsSync(dir)) return
  for (const f of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, f)
    const st = fs.statSync(p)
    if (st.isDirectory()) {
      console.log(prefix + f + '/')
      tree(p, prefix + '  ', depth + 1)
    } else {
      console.log(prefix + f + '  [' + st.size + ']')
    }
  }
}

console.log('==== D:/src/tools/AgentTool ====')
tree('D:/src/tools/AgentTool')

console.log('\n==== find files with agent in name under D:/src/tools ====')
for (const f of fs.readdirSync('D:/src/tools')) {
  if (/agent/i.test(f)) console.log(f)
}

console.log('\n==== KX2API src/engine/agent ====')
tree('D:/KX2API/src/engine/agent')