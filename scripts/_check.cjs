const fs = require('node:fs')
const files = fs.readdirSync('D:/KX2API/tests')
for (const f of files.sort()) {
  if (/tokenEstimation|diffParser|jsonRepair|ecoFilter|semanticSearch|knowledgeGraph/.test(f)) {
    const st = fs.statSync('D:/KX2API/tests/' + f)
    console.log(f + '  [' + st.size + ']')
  }
}
// 清理遗留脚本
for (const s of ['_del.cjs', '_pkg.cjs', '_verify.cjs', '_verify_registry.cjs']) {
  const p = 'D:/KX2API/scripts/' + s
  if (fs.existsSync(p)) { fs.unlinkSync(p); console.log('cleaned', p) }
}