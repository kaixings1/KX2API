import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'

function run(label, cmd, args) {
  const r = spawnSync(cmd, args, {
    cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1024 * 1024 * 256,
  })
  const out = (r.stdout || '') + (r.stderr || '')
  console.log(`\n===== ${label} (exit=${r.status}) =====`)
  console.log(out.split('\n').slice(-14).join('\n'))
  return r.status ?? 1
}

const log = []
log.push(['TYPECHECK', run('TYPECHECK', process.execPath, ['./node_modules/typescript/bin/tsc', '-p', 'tsconfig.check.json', '--noEmit'])])
log.push(['AGENT', run('AGENT', process.execPath, ['tests/agent/run.mjs'])])
log.push(['MANAGEMENT', run('MANAGEMENT', process.execPath, ['tests/management/run.mjs'])])
log.push(['EXTRAS', run('EXTRAS', process.execPath, ['tests/run-all.mjs'])])
log.push(['UNIT', run('UNIT', process.execPath, ['./node_modules/vitest/vitest.mjs', 'run'])])

console.log('\n\n========== SUMMARY ==========')
for (const [name, code] of log) console.log(`${code === 0 ? 'PASS' : 'FAIL'}  ${name} (exit=${code})`)
rmSync('_final.mjs', { force: true })
process.exit(0)
