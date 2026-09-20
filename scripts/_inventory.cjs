// 盘点 D:/src/utils 下的纯函数候选文件（看行数/字节）
const fs = require('node:fs')
const path = require('node:path')

const dir = 'D:/src/utils'
if (!fs.existsSync(dir)) { console.log('NOT FOUND: ' + dir); process.exit(0) }
const rows = []
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.ts')) continue
  const p = path.join(dir, f)
  const st = fs.statSync(p)
  if (!st.isFile()) continue
  const lines = fs.readFileSync(p, 'utf8').split('\n').length
  rows.push([lines, st.size, f])
}
rows.sort((a, b) => b[0] - a[0])
for (const [l, sz, f] of rows) {
  console.log(String(l).padStart(5) + '  ' + String(sz).padStart(7) + '  ' + f)
}
console.log('TOTAL files:', rows.length)