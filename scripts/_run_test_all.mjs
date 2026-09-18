import { spawnSync } from 'node:child_process'

const r = spawnSync('npm', ['run', 'test:all'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  maxBuffer: 1024 * 1024 * 64,
})
const out = (r.stdout || '') + (r.stderr || '')
// 提取关键汇总行
const lines = out.split('\n')
const summary = lines.filter((l) =>
  /通过|失败|passed|failed|Tests |合计|EXIT|Error:/i.test(l)
)
console.log('=== TEST:ALL RESULT ===')
for (const l of summary.slice(-40)) console.log(l)
process.exit(r.status ?? 1)
