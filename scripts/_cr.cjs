const { spawnSync } = require('node:child_process')
const r = spawnSync('node', ['scripts/check-repo.mjs', '--no-write'], { cwd: 'D:/KX2API', encoding: 'utf8' })
const out = r.stdout
// 找"应用运行时"区域里 src/ 相关，以及遥测/未引用部分
const lines = out.split('\n')
const idx = lines.findIndex(l => /遗留待接入|未接入|orphan|孤立/i.test(l))
if (idx >= 0) {
  console.log('=== 未接入/遗留区 ===')
  console.log(lines.slice(idx, idx + 40).join('\n'))
} else {
  console.log('无未接入区标记。全文状态行：')
  const stat = lines.filter(l => /通过|失败|全部|合计|已接入|未接入/.test(l))
  console.log(stat.join('\n'))
}
console.log('=== exit:', r.status, '===')
console.log('exit code ok, total lines:', lines.length)