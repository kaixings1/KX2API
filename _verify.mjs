import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const results = []

function run(label, cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1024 * 1024 * 256,
    ...opts,
  })
  const out = (r.stdout || '') + (r.stderr || '')
  results.push({ label, code: r.status, out })
  return r.status ?? 1
}

// 1) typecheck
run('TYPECHECK', process.execPath, ['./node_modules/typescript/bin/tsc', '-p', 'tsconfig.check.json', '--noEmit'])

// 2) build
run('BUILD', 'npm.cmd', ['run', 'build'])

// 3) agent tests
run('AGENT', process.execPath, ['tests/agent/run.mjs'])

// 4) management tests
run('MANAGEMENT', process.execPath, ['tests/management/run.mjs'])

// 5) extras tests
run('EXTRAS', process.execPath, ['tests/run-all.mjs'])

// 6) vitest unit
run('UNIT', process.execPath, ['./node_modules/vitest/vitest.mjs', 'run'])

for (const r of results) {
  console.log(`\n\n########## ${r.label} (exit=${r.code}) ##########`)
  const lines = r.out.split('\n')
  // 只输出尾部关键行，避免刷屏
  const tail = lines.slice(-45).join('\n')
  console.log(tail)
}

const failed = results.filter((r) => r.code !== 0)
console.log('\n\n===== SUMMARY =====')
for (const r of results) console.log(`${r.code === 0 ? 'PASS' : 'FAIL'} ${r.label} (exit=${r.code})`)
process.exit(failed.length > 0 ? 1 : 0)
