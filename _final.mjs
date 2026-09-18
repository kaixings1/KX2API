import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
function run(label, cmd, args) {
  const r = spawnSync(cmd, args, { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 * 256 })
  const out = (r.stdout || '') + (r.stderr || '')
  console.log(`\n== ${label} (exit=${r.status}) ==`)
  console.log(out.split('\n').slice(-6).join('\n'))
  return r.status ?? 1
}
const res = []
res.push(['TYPECHECK', run('TYPECHECK', process.execPath, ['./node_modules/typescript/bin/tsc', '-p', 'tsconfig.check.json', '--noEmit'])])
res.push(['AGENT', run('AGENT', process.execPath, ['tests/agent/run.mjs'])])
res.push(['MANAGEMENT', run('MANAGEMENT', process.execPath, ['tests/management/run.mjs'])])
res.push(['EXTRAS', run('EXTRAS', process.execPath, ['tests/run-all.mjs'])])
res.push(['UNIT', run('UNIT', process.execPath, ['./node_modules/vitest/vitest.mjs', 'run'])])
res.push(['BUILD', run('BUILD', process.execPath, ['node_modules/electron-vite/bin/electron-vite.js', 'build'])])
console.log('\n\n========== SUMMARY ==========')
for (const [n, c] of res) console.log(`${c === 0 ? 'PASS' : 'FAIL'}  ${n}`)
rmSync('_final.mjs', { force: true })
process.exit(0)
