import { spawnSync } from 'node:child_process'
function run(label, cmd, args) {
  const r = spawnSync(cmd, args, { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 * 256 })
  console.log(`== ${label} (exit=${r.status}) ==`)
  console.log((((r.stdout || '') + (r.stderr || '')).split('\n').slice(-6)).join('\n'))
  return r.status ?? 1
}
const res = []
res.push(['TYPECHECK', run('TYPECHECK', process.execPath, ['./node_modules/typescript/bin/tsc', '-p', 'tsconfig.check.json', '--noEmit'])])
res.push(['EXTRAS', run('EXTRAS', process.execPath, ['tests/run-all.mjs'])])
console.log('\n=== ' + res.map(([n, c]) => `${c === 0 ? 'PASS' : 'FAIL'} ${n}`).join(' | ') + ' ===')
process.exit(0)
